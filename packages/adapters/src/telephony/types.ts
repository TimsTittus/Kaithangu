/**
 * Telephony adapter (AGENTS.md 3, 4.5): places outbound calls and fetches/
 * deletes call recordings. apps/voice depends on this file only; the real
 * implementation is Twilio, chosen by TELEPHONY_MODE / ADAPTER_MODE.
 */
export { isNotConfiguredError, NotConfiguredError } from '../notConfigured';

export interface PlaceCallInput {
  to: string;
  /** Absolute URL Twilio requests TwiML from once the call connects. */
  url: string;
  /** Absolute URL Twilio posts call status changes to. */
  statusCallbackUrl?: string;
}

export interface RecordingFetch {
  audio: Uint8Array;
  /** Base MIME type of the fetched recording, e.g. audio/x-wav. */
  mimeType: string;
}

export interface TelephonyAdapter {
  /** Returns the provider's call SID. */
  placeCall(input: PlaceCallInput): Promise<{ callSid: string }>;
  /** Fetches a call recording; retries internally while Twilio finishes processing it. */
  fetchRecording(recordingUrl: string): Promise<RecordingFetch>;
  /** Deletes a recording from the provider (consent-gated in the caller). */
  deleteRecording(recordingUrl: string): Promise<void>;
}
