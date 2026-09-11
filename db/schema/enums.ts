import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'worker', 'corporate']);

export const consentPurpose = pgEnum('consent_purpose', ['platform_terms']);

export const workerStatus = pgEnum('worker_status', ['pending', 'verified', 'suspended']);

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
