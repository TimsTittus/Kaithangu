import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { identityColumns, phoneE164Check, point, tstz } from './columns';
import {
  workerAvailabilityDays,
  workerAvailabilityHours,
  workerCertificationStatus,
  workerOnboardingStep,
  workerRegistrationStatus,
  workerStatus,
} from './enums';
import { trades } from './region';

export const worker = pgTable(
  'worker',
  {
    ...identityColumns('worker'),
    status: workerStatus('status').notNull().default('pending'),
    available: boolean('available').notNull().default(false),
    hasSmartphone: boolean('has_smartphone').notNull().default(false),
    ratingSum: integer('rating_sum').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    qrKeyVersion: integer('qr_key_version').notNull().default(1),
    registrationStatus: workerRegistrationStatus('registration_status')
      .notNull()
      .default('in_progress'),
    onboardingStep: workerOnboardingStep('onboarding_step'),
    serviceRadiusKm: smallint('service_radius_km'),
    availabilityDays: workerAvailabilityDays('availability_days'),
    availabilityHours: workerAvailabilityHours('availability_hours'),
    upiId: text('upi_id'),
    certificationStatus: workerCertificationStatus('certification_status'),
    consentDataUse: boolean('consent_data_use').notNull().default(false),
    consentRecordingRetention: boolean('consent_recording_retention').notNull().default(false),
    fairnessExplained: boolean('fairness_explained').notNull().default(false),
    identityVerifiedAt: tstz('identity_verified_at'),
    submittedAt: tstz('submitted_at'),
    lastInteractionId: text('last_interaction_id'),
  },
  (t) => [
    phoneE164Check('worker', t.phone),
    index('worker_status_available_idx').on(t.status, t.available),
    index('worker_registration_status_idx').on(t.registrationStatus),
    check(
      'worker_rating_consistent',
      sql`${t.ratingCount} >= 0 AND ${t.ratingSum} BETWEEN ${t.ratingCount} AND 5 * ${t.ratingCount}`,
    ),
    check(
      'worker_service_radius_preset',
      sql`${t.serviceRadiusKm} IS NULL OR ${t.serviceRadiusKm} IN (2, 5, 10)`,
    ),
    check(
      'worker_upi_vpa',
      sql`${t.upiId} IS NULL OR ${t.upiId} ~ '^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$'`,
    ),
  ],
);

export const workerSkills = pgTable(
  'worker_skills',
  {
    workerId: uuid('worker_id')
      .notNull()
      .references(() => worker.id),
    tradeCode: text('trade_code')
      .notNull()
      .references(() => trades.code),
    level: smallint('level').notNull(),
    certified: boolean('certified').notNull().default(false),
    verified: boolean('verified').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.workerId, t.tradeCode] }),
    index('worker_skills_trade_idx').on(t.tradeCode),
    check('worker_skills_level_range', sql`${t.level} BETWEEN 1 AND 3`),
  ],
);

export const workerServiceAreas = pgTable(
  'worker_service_areas',
  {
    workerId: uuid('worker_id')
      .notNull()
      .references(() => worker.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    pincode: text('pincode').notNull(),
    location: point('location'),
    needsFollowup: boolean('needs_followup').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.workerId, t.position] }),
    unique('worker_service_areas_worker_pincode_unique').on(t.workerId, t.pincode),
    index('worker_service_areas_pincode_idx').on(t.pincode),
    check('worker_service_areas_position_range', sql`${t.position} BETWEEN 1 AND 2`),
    check('worker_service_areas_pincode_format', sql`${t.pincode} ~ '^[1-9][0-9]{5}$'`),
  ],
);
