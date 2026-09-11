// Shared by the server page and the client wizard. Kept out of the
// 'use client' module: a server component importing a value from a client
// module gets a client reference, not the value.

/** Catalog keys the wizard needs (raw, placeholders filled on the client). */
export const WIZARD_KEYS = [
  'booking.title',
  'booking.step',
  'booking.problem_title',
  'booking.problem_label',
  'booking.problem_placeholder',
  'booking.problem_required',
  'booking.quick_picks',
  'booking.mic_start',
  'booking.mic_stop',
  'booking.mic_listening',
  'booking.mic_processing',
  'booking.mic_failed',
  'booking.mic_denied',
  'booking.location_title',
  'booking.use_location',
  'booking.locating',
  'booking.location_failed',
  'booking.location_found',
  'booking.saved_addresses',
  'booking.pincode_label',
  'booking.pincode_hint',
  'booking.pincode_invalid',
  'booking.landmark_label',
  'booking.landmark_required',
  'booking.location_required',
  'booking.map_label',
  'booking.map_unavailable',
  'booking.when_title',
  'booking.when_now',
  'booking.when_now_hint',
  'booking.when_emergency',
  'booking.when_emergency_hint',
  'booking.when_slot',
  'booking.when_slot_hint',
  'booking.slot_day',
  'booking.slot_time',
  'booking.slot_required',
  'booking.no_slots',
  'booking.quote_title',
  'booking.quote_loading',
  'booking.quote_minutes',
  'booking.quote_welfare_note',
  'booking.quote_total',
  'booking.quote_total_audio',
  'booking.quote_placeholder_note',
  'booking.quote_retry',
  'booking.confirm',
  'booking.confirming',
  'common.back',
  'common.next',
] as const;

export interface SlotDay {
  key: string;
  label: string;
  slots: { iso: string; label: string }[];
}
