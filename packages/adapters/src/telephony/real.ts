/**
 * Twilio telephony adapter: places outbound calls and fetches/deletes call
 * recordings via the REST API (fetch + Basic Auth, no SDK dependency —
 * matches the pattern in speech/real.ts).
 */
import { z } from 'zod';
import { NotConfiguredError } from '../notConfigured';
import type { PlaceCallInput, RecordingFetch, TelephonyAdapter } from './types';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';
const REQUEST_TIMEOUT_MS = 15_000;
/** Twilio recordings can take a moment to finish processing after the call ends. */
const RECORDING_FETCH_ATTEMPTS = 5;
const RECORDING_FETCH_BACKOFF_MS = 600;

const callResponse = z.object({ sid: z.string() });

export interface RealTelephonyOptions {
  accountSid: string | undefined;
  authToken: string | undefined;
  fromNumber: string | undefined;
  fetch?: typeof fetch;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRealTelephonyAdapter({
  accountSid,
  authToken,
  fromNumber,
  fetch: fetchImpl = fetch,
}: RealTelephonyOptions): TelephonyAdapter {
  function requireCredentials(): { accountSid: string; authToken: string; fromNumber: string } {
    if (!accountSid || !authToken || !fromNumber) throw new NotConfiguredError('telephony');
    return { accountSid, authToken, fromNumber };
  }

  function authHeader(user: string, pass: string): string {
    return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }

  return {
    async placeCall({ to, url, statusCallbackUrl }: PlaceCallInput): Promise<{ callSid: string }> {
      const creds = requireCredentials();
      const body = new URLSearchParams({ To: to, From: creds.fromNumber, Url: url });
      if (statusCallbackUrl) body.set('StatusCallback', statusCallbackUrl);

      const response = await fetchImpl(`${TWILIO_API_BASE}/Accounts/${creds.accountSid}/Calls.json`, {
        method: 'POST',
        headers: {
          authorization: authHeader(creds.accountSid, creds.authToken),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`twilio Calls.create failed with HTTP ${response.status}`);
      }
      const { sid } = callResponse.parse(await response.json());
      return { callSid: sid };
    },

    async fetchRecording(recordingUrl: string): Promise<RecordingFetch> {
      const creds = requireCredentials();
      let lastStatus = 0;
      for (let attempt = 0; attempt < RECORDING_FETCH_ATTEMPTS; attempt += 1) {
        const response = await fetchImpl(recordingUrl, {
          headers: { authorization: authHeader(creds.accountSid, creds.authToken) },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) {
          const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'audio/x-wav';
          return { audio: new Uint8Array(await response.arrayBuffer()), mimeType };
        }
        lastStatus = response.status;
        if (response.status !== 404 && response.status !== 409) break;
        await sleep(RECORDING_FETCH_BACKOFF_MS);
      }
      throw new Error(`twilio recording not available after retries (last HTTP ${lastStatus}): ${recordingUrl}`);
    },

    async deleteRecording(recordingUrl: string): Promise<void> {
      const creds = requireCredentials();
      const response = await fetchImpl(recordingUrl, {
        method: 'DELETE',
        headers: { authorization: authHeader(creds.accountSid, creds.authToken) },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`twilio recording delete failed with HTTP ${response.status}`);
      }
    },
  };
}
