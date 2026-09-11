import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', [
  'customer',
  'worker',
  'lcs_admin',
  'state_admin',
  'national_admin',
  'institution_admin',
]);

export const federationLevel = pgEnum('federation_level', ['national', 'state']);

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

export const offerChannel = pgEnum('offer_channel', ['app', 'sms', 'ivr']);
export const offerResponse = pgEnum('offer_response', [
  'accepted',
  'declined',
  'timeout',
  'superseded',
]);

export const paymentMethod = pgEnum('payment_method', ['upi', 'cash']);
export const paymentStatus = pgEnum('payment_status', [
  'created',
  'captured',
  'failed',
  'refunded',
]);

export const ledgerDirection = pgEnum('ledger_direction', ['credit', 'debit']);
export const ledgerKind = pgEnum('ledger_kind', [
  'wage',
  'welfare',
  'platform_fee',
  'gst',
  'cash_offset',
  'payout',
  'adjustment',
]);

export const ratingChannel = pgEnum('rating_channel', ['app', 'voice']);
export const sentiment = pgEnum('sentiment', ['positive', 'neutral', 'negative']);

export const disputeStatus = pgEnum('dispute_status', [
  'open',
  'investigating',
  'resolved',
  'rejected',
]);

export const enrolmentStatus = pgEnum('enrolment_status', [
  'interested',
  'submitted',
  'enrolled',
  'rejected',
]);

export const callDirection = pgEnum('call_direction', ['inbound', 'outbound']);
export const callPurpose = pgEnum('call_purpose', [
  'customer_booking',
  'worker_offer',
  'worker_availability',
  'worker_job',
  'onboarding',
  'rating',
  'status_update',
  'broadcast',
]);

export const reliefRateMode = pgEnum('relief_rate_mode', ['normal', 'no_surcharge']);

export const notificationChannel = pgEnum('notification_channel', ['app', 'sms', 'ivr']);
