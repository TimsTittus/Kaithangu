/**
 * Dispatch candidate query (AGENTS.md 6.3). Raw SQL (drizzle sql`` tagged
 * templates, always parameterized) so every hard filter runs in Postgres;
 * packages/core/matching/score.ts only scores and ranks what comes back.
 * Distances are computed on geography, matching AGENTS.md 5.
 */
import type { LngLat } from '@kaithangu/core';
import { sql } from 'drizzle-orm';
import type { Database } from '../client';

export interface CandidateRow {
  workerId: string;
  distanceKm: number;
  serviceRadiusKm: number;
  skillLevel: number;
  ratingSum: number;
  ratingCount: number;
  earnings30dPaise: number;
  lastJobCompletedAt: Date | null;
  hasSmartphone: boolean;
}

export interface FindCandidatesInput {
  bookingId: string;
  societyId: string;
  tradeCode: string;
  certifiedRequired: boolean;
  location: LngLat;
  /** Bayesian-rating hard filter needs the society's prior (AGENTS.md 6.3). */
  societyMeanRating: number;
}

/**
 * Every AGENTS.md 6.3 hard filter, applied in SQL: verified, has the trade
 * (certified if required), available, no conflicting active booking, within
 * service radius, and (bayesian rating >= 3.5 OR rating_count < 5). Excludes
 * workers already offered this booking (so re-running the query after a
 * decline/timeout naturally advances to the next candidate).
 */
export async function findCandidates(
  db: Database,
  input: FindCandidatesInput,
): Promise<CandidateRow[]> {
  const here = sql`ST_SetSRID(ST_MakePoint(${input.location.lng}::double precision, ${input.location.lat}::double precision), 4326)::geography`;
  const rows = await db.execute<{
    worker_id: string;
    distance_km: number;
    service_radius_km: number;
    skill_level: number;
    rating_sum: number;
    rating_count: number;
    earnings_30d_paise: string | number;
    last_job_completed_at: Date | null;
    has_smartphone: boolean;
  }>(sql`
    WITH skill AS (
      SELECT ws.worker_id, ws.level, ws.certified
      FROM worker_skills ws
      WHERE ws.trade_code = ${input.tradeCode}
        AND (${input.certifiedRequired} = false OR ws.certified = true)
    ),
    earnings AS (
      SELECT b.worker_id, COALESCE(SUM(b.wage_paise), 0) AS earnings_30d_paise
      FROM bookings b
      WHERE b.status = 'completed'
        AND b.completed_at >= now() - interval '30 days'
      GROUP BY b.worker_id
    )
    SELECT
      w.user_id AS worker_id,
      ST_Distance(w.home_location::geography, ${here}) / 1000.0 AS distance_km,
      w.service_radius_km::double precision AS service_radius_km,
      skill.level AS skill_level,
      w.rating_sum AS rating_sum,
      w.rating_count AS rating_count,
      COALESCE(earnings.earnings_30d_paise, 0) AS earnings_30d_paise,
      w.last_job_completed_at AS last_job_completed_at,
      w.has_smartphone AS has_smartphone
    FROM workers w
    JOIN skill ON skill.worker_id = w.user_id
    LEFT JOIN earnings ON earnings.worker_id = w.user_id
    WHERE w.society_id = ${input.societyId}
      AND w.status = 'verified'
      AND w.available = true
      AND ST_DWithin(w.home_location::geography, ${here}, w.service_radius_km * 1000)
      AND (
        (5 * ${input.societyMeanRating}::double precision + w.rating_sum)
          / (5 + w.rating_count) >= 3.5
        OR w.rating_count < 5
      )
      AND NOT EXISTS (
        SELECT 1 FROM bookings b2
        WHERE b2.worker_id = w.user_id
          AND b2.status IN ('accepted', 'en_route', 'in_progress')
      )
      AND NOT EXISTS (
        SELECT 1 FROM booking_offers bo
        WHERE bo.booking_id = ${input.bookingId}
          AND bo.worker_id = w.user_id
      )
  `);

  return rows.map((row) => ({
    workerId: row.worker_id,
    distanceKm: Number(row.distance_km),
    serviceRadiusKm: Number(row.service_radius_km),
    skillLevel: Number(row.skill_level),
    ratingSum: Number(row.rating_sum),
    ratingCount: Number(row.rating_count),
    earnings30dPaise: Number(row.earnings_30d_paise),
    lastJobCompletedAt:
      row.last_job_completed_at === null ? null : new Date(row.last_job_completed_at),
    hasSmartphone: row.has_smartphone,
  }));
}

export interface MatchContextRow {
  societyMeanRating: number;
  medianEarnings30dPaise: number;
}

/**
 * The Bayesian prior (society's mean star rating, 1 when it has no ratings
 * yet) and the median 30-day wage total among verified workers of the
 * society and trade (0 when there are none), per AGENTS.md 6.3/6.8.
 */
export async function loadMatchContext(
  db: Database,
  societyId: string,
  tradeCode: string,
): Promise<MatchContextRow> {
  const rows = await db.execute<{
    society_mean_rating: number | null;
    median_earnings_30d_paise: number | null;
  }>(sql`
    WITH society_ratings AS (
      SELECT AVG(r.stars)::double precision AS mean
      FROM ratings r
      JOIN bookings b ON b.id = r.booking_id
      WHERE b.society_id = ${societyId}
    ),
    trade_workers AS (
      SELECT w.user_id
      FROM workers w
      JOIN worker_skills ws ON ws.worker_id = w.user_id AND ws.trade_code = ${tradeCode}
      WHERE w.society_id = ${societyId} AND w.status = 'verified'
    ),
    earnings AS (
      SELECT tw.user_id,
        COALESCE((
          SELECT SUM(b.wage_paise)
          FROM bookings b
          WHERE b.worker_id = tw.user_id
            AND b.status = 'completed'
            AND b.completed_at >= now() - interval '30 days'
        ), 0) AS earnings_30d_paise
      FROM trade_workers tw
    )
    SELECT
      COALESCE((SELECT mean FROM society_ratings), 1) AS society_mean_rating,
      COALESCE(
        (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY earnings_30d_paise) FROM earnings),
        0
      ) AS median_earnings_30d_paise
  `);
  const row = rows[0];
  return {
    societyMeanRating:
      row?.society_mean_rating === null || row?.society_mean_rating === undefined
        ? 1
        : Number(row.society_mean_rating),
    medianEarnings30dPaise:
      row?.median_earnings_30d_paise === null || row?.median_earnings_30d_paise === undefined
        ? 0
        : Number(row.median_earnings_30d_paise),
  };
}

/**
 * The society (LCS) nearest to `location` within `stateCode` (AGENTS.md 1:
 * workers are a society's own members, so matching runs within one society).
 * A booking is assigned its nearest society once, at match time, mirroring
 * the nearest-pincode pattern in sql/places.ts. Null when the state has none.
 */
export async function nearestSociety(
  db: Database,
  stateCode: string,
  location: LngLat,
): Promise<string | null> {
  const here = sql`ST_SetSRID(ST_MakePoint(${location.lng}::double precision, ${location.lat}::double precision), 4326)::geography`;
  const rows = await db.execute<{ id: string }>(sql`
    SELECT id
    FROM societies
    WHERE state_code = ${stateCode}
    ORDER BY ST_Distance(location::geography, ${here}), id
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}
