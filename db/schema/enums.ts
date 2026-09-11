import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'worker', 'corporate']);

export const consentPurpose = pgEnum('consent_purpose', [
  'platform_terms',
  'call_recording',
  'data_processing',
]);
export const consentChannel = pgEnum('consent_channel', ['web', 'voice']);

export const workerStatus = pgEnum('worker_status', ['pending', 'verified', 'suspended']);
export const skillSource = pgEnum('skill_source', [
  'roster',
  'voice_interview',
  'certificate',
  'admin',
]);

export const institutionType = pgEnum('institution_type', [
  'school',
  'panchayat',
  'hospital',
  'office',
  'other',
]);

export const bookingSource = pgEnum('booking_source', [
  'pwa',
  'voice',
  'institution',
  'admin',
  'ondc',
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
