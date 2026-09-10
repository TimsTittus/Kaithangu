/**
 * Idempotent turn webhooks (Phase 7 spec): Twilio retries a webhook that
 * didn't answer in time using the identical CallSid + Digits/RecordingUrl.
 * Re-running flow.step on a retry would double-execute actions (e.g.
 * createBooking); instead each call_sessions row remembers the fingerprint
 * of the last request it actually processed and replays the same TwiML for
 * a repeat of that exact request, without touching the flow.
 */
import { createHash } from 'node:crypto';

export interface TurnIdempotencyMeta {
  turnIndex: number;
  lastFingerprint: string;
  lastTwiml: string;
}

export function requestFingerprint(params: Readonly<Record<string, string>>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]] as const);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/** Returns the cached TwiML for a repeated request, or null if this request is new. */
export function replayIfDuplicate(
  meta: TurnIdempotencyMeta | undefined,
  fingerprint: string,
): string | null {
  return meta && meta.lastFingerprint === fingerprint ? meta.lastTwiml : null;
}

export function nextMeta(
  meta: TurnIdempotencyMeta | undefined,
  fingerprint: string,
  twiml: string,
): TurnIdempotencyMeta {
  return { turnIndex: (meta?.turnIndex ?? 0) + 1, lastFingerprint: fingerprint, lastTwiml: twiml };
}
