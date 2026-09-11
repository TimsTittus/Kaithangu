import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'worker', 'corporate']);

export const consentPurpose = pgEnum('consent_purpose', [
  'platform_terms',
  'worker_data_use',
  'call_recording_retention',
]);

export const workerStatus = pgEnum('worker_status', ['pending', 'verified', 'suspended']);

export const workerRegistrationStatus = pgEnum('worker_registration_status', [
  'in_progress',
  'submitted',
]);

export const workerOnboardingStep = pgEnum('worker_onboarding_step', [
  'name',
  'language',
  'smartphone',
  'trades',
  'skills',
  'service_area',
  'availability',
  'payout',
  'certification',
  'consent',
  'fairness',
  'confirmation',
]);

export const workerAvailabilityDays = pgEnum('worker_availability_days', [
  'weekdays',
  'weekends',
  'all_days',
]);

export const workerAvailabilityHours = pgEnum('worker_availability_hours', [
  'mornings',
  'afternoons',
  'evenings',
  'full_day',
]);

export const workerCertificationStatus = pgEnum('worker_certification_status', [
  'not_required',
  'pending_upload',
  'pending_review',
]);

export const urgency = pgEnum('urgency', ['normal', 'emergency']);

/** AGENTS.md 6.5 booking state machine. */
export const bookingStatus = pgEnum('booking_status', [
  'requested',
  'matching',
  'offered',
  'accepted',
  'en_route',
  'in_progress',
  'completed',
  'unassigned',
  'cancelled',
  'disputed',
  'resolved',
]);
