/**
 * Candidate scoring (AGENTS.md 6.3). Hard filters run in SQL; this module only
 * scores and ranks the candidates that passed them.
 *   proximity       = clamp(1 − distance_km / service_radius_km, 0, 1)
 *   skill_fit       = skill_level / 3
 *   bayesian_rating = (5 × society_mean + rating_sum) / (5 + rating_count)
 *   rating_norm     = (bayesian_rating − 1) / 4
 *   fairness_boost  = median_30d > 0 ? clamp((median_30d − worker_30d) / median_30d, 0, 1)
 *                                    : (worker_30d == 0 ? 1 : 0)
 *   normal              = 0.35·proximity + 0.25·skill_fit + 0.15·rating_norm + 0.25·fairness_boost
 *   emergency/disaster  = 0.70·proximity + 0.20·skill_fit + 0.10·rating_norm
 *   tie-break: oldest last_job_completed_at first (null first), then worker id.
 * Every result carries the full breakdown and a "why this worker" i18n key +
 * params naming the factor that contributed most.
 */

export type MatchMode = 'normal' | 'emergency' | 'disaster';

export interface MatchCandidate {
  workerId: string;
  distanceKm: number;
  serviceRadiusKm: number;
  /** Skill level for the booked trade, 1..3. */
  skillLevel: number;
  ratingSum: number;
  ratingCount: number;
  /** 30-day wage total in paise. */
  earnings30dPaise: number;
  lastJobCompletedAt: Date | null;
}

export interface MatchContext {
  /** Mean star rating of the society (1..5), the Bayesian prior. */
  societyMeanRating: number;
  /** Median 30-day wage total (paise) among verified workers of the same society and trade. */
  medianEarnings30dPaise: number;
}

export const SCORE_FACTORS = ['proximity', 'skill', 'rating', 'fairness'] as const;
export type ScoreFactor = (typeof SCORE_FACTORS)[number];

export type ScoreWeights = Readonly<Record<ScoreFactor, number>>;

export const NORMAL_WEIGHTS: ScoreWeights = {
  proximity: 0.35,
  skill: 0.25,
  rating: 0.15,
  fairness: 0.25,
};

export const EMERGENCY_WEIGHTS: ScoreWeights = {
  proximity: 0.7,
  skill: 0.2,
  rating: 0.1,
  fairness: 0,
};

export function weightsFor(mode: MatchMode): ScoreWeights {
  return mode === 'normal' ? NORMAL_WEIGHTS : EMERGENCY_WEIGHTS;
}

export interface ScoreBreakdown {
  mode: MatchMode;
  distanceKm: number;
  serviceRadiusKm: number;
  skillLevel: number;
  ratingSum: number;
  ratingCount: number;
  societyMeanRating: number;
  earnings30dPaise: number;
  medianEarnings30dPaise: number;
  proximity: number;
  skillFit: number;
  bayesianRating: number;
  ratingNorm: number;
  fairnessBoost: number;
  weights: ScoreWeights;
  contributions: Record<ScoreFactor, number>;
}

export interface ScoreExplanation {
  key: `matching.why.${ScoreFactor}`;
  params: { distanceKm: number; skillLevel: number; rating: number };
}

export interface CandidateScore {
  score: number;
  breakdown: ScoreBreakdown;
  explanation: ScoreExplanation;
}

export interface RankedCandidate extends CandidateScore {
  candidate: MatchCandidate;
  /** 1-based position in the ranking. */
  rank: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

function assertRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be within [${min}, ${max}], got ${value}`);
  }
}

function validate(candidate: MatchCandidate, context: MatchContext): void {
  assertRange('distanceKm', candidate.distanceKm, 0, Number.MAX_VALUE);
  assertRange('serviceRadiusKm', candidate.serviceRadiusKm, Number.MIN_VALUE, Number.MAX_VALUE);
  if (!Number.isInteger(candidate.skillLevel)) {
    throw new RangeError(`skillLevel must be an integer, got ${candidate.skillLevel}`);
  }
  assertRange('skillLevel', candidate.skillLevel, 1, 3);
  if (!Number.isSafeInteger(candidate.ratingCount) || candidate.ratingCount < 0) {
    throw new RangeError(
      `ratingCount must be a non-negative integer, got ${candidate.ratingCount}`,
    );
  }
  // Same bound as the workers_rating_consistent DB check: 1..5 stars per rating.
  assertRange('ratingSum', candidate.ratingSum, candidate.ratingCount, 5 * candidate.ratingCount);
  assertRange('earnings30dPaise', candidate.earnings30dPaise, 0, Number.MAX_SAFE_INTEGER);
  if (
    candidate.lastJobCompletedAt !== null &&
    Number.isNaN(candidate.lastJobCompletedAt.getTime())
  ) {
    throw new RangeError('lastJobCompletedAt must be a valid date or null');
  }
  assertRange('societyMeanRating', context.societyMeanRating, 1, 5);
  assertRange('medianEarnings30dPaise', context.medianEarnings30dPaise, 0, Number.MAX_SAFE_INTEGER);
}

export function fairnessBoost(worker30dPaise: number, median30dPaise: number): number {
  if (median30dPaise > 0) {
    return clamp01((median30dPaise - worker30dPaise) / median30dPaise);
  }
  return worker30dPaise === 0 ? 1 : 0;
}

export function scoreCandidate(
  candidate: MatchCandidate,
  context: MatchContext,
  mode: MatchMode,
): CandidateScore {
  validate(candidate, context);
  const proximity = clamp01(1 - candidate.distanceKm / candidate.serviceRadiusKm);
  const skillFit = candidate.skillLevel / 3;
  const bayesianRating =
    (5 * context.societyMeanRating + candidate.ratingSum) / (5 + candidate.ratingCount);
  const ratingNorm = (bayesianRating - 1) / 4;
  const boost = fairnessBoost(candidate.earnings30dPaise, context.medianEarnings30dPaise);

  const weights = weightsFor(mode);
  const contributions: Record<ScoreFactor, number> = {
    proximity: weights.proximity * proximity,
    skill: weights.skill * skillFit,
    rating: weights.rating * ratingNorm,
    fairness: weights.fairness * boost,
  };
  const score =
    contributions.proximity + contributions.skill + contributions.rating + contributions.fairness;

  // The factor contributing most; ties resolve in SCORE_FACTORS order.
  let top: ScoreFactor = SCORE_FACTORS[0];
  for (const factor of SCORE_FACTORS) {
    if (contributions[factor] > contributions[top]) top = factor;
  }

  return {
    score,
    breakdown: {
      mode,
      distanceKm: candidate.distanceKm,
      serviceRadiusKm: candidate.serviceRadiusKm,
      skillLevel: candidate.skillLevel,
      ratingSum: candidate.ratingSum,
      ratingCount: candidate.ratingCount,
      societyMeanRating: context.societyMeanRating,
      earnings30dPaise: candidate.earnings30dPaise,
      medianEarnings30dPaise: context.medianEarnings30dPaise,
      proximity,
      skillFit,
      bayesianRating,
      ratingNorm,
      fairnessBoost: boost,
      weights,
      contributions,
    },
    explanation: {
      key: `matching.why.${top}`,
      params: {
        distanceKm: oneDecimal(candidate.distanceKm),
        skillLevel: candidate.skillLevel,
        rating: oneDecimal(bayesianRating),
      },
    },
  };
}

function compareLastJob(a: Date | null, b: Date | null): number {
  if (a === null || b === null) {
    return a === b ? 0 : a === null ? -1 : 1;
  }
  return a.getTime() - b.getTime();
}

/** Score and sort best-first: score desc, then oldest last job (null first), then worker id. */
export function rankCandidates(
  candidates: readonly MatchCandidate[],
  context: MatchContext,
  mode: MatchMode,
): RankedCandidate[] {
  return candidates
    .map((candidate) => ({ candidate, ...scoreCandidate(candidate, context, mode) }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const byLastJob = compareLastJob(
        a.candidate.lastJobCompletedAt,
        b.candidate.lastJobCompletedAt,
      );
      if (byLastJob !== 0) return byLastJob;
      const idA = a.candidate.workerId;
      const idB = b.candidate.workerId;
      return idA < idB ? -1 : idA > idB ? 1 : 0;
    })
    .map((scored, index) => ({ ...scored, rank: index + 1 }));
}
