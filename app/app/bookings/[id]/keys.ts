// Kept out of the 'use client' tracker module: a server component importing a
// value from a client module gets a client reference, not the value.

/** Catalog keys the tracking page needs (raw, placeholders filled on the client). */
export const TRACKER_KEYS = [
  'booking.tracking_title',
  'booking.timeline',
  'booking.live_hint',
  'booking.worker_title',
  'booking.verified_by',
  'booking.verification_code',
  'booking.verification_hint',
  'booking.rating',
  'booking.new_worker',
  'booking.start_otp',
  'booking.complete_otp',
  'booking.otp_hint',
  'booking.cancel',
  'booking.cancel_confirm',
  'booking.cancel_yes',
  'booking.cancel_no',
  'booking.cancelling',
  'booking.details',
  'booking.problem',
  'booking.address',
  'booking.when',
  'booking.asap',
  'booking.total',
  'booking.emergency_badge',
  'booking.home',
] as const;
