/**
 * Codes shown to the customer on the tracking page (AGENTS.md 6.6).
 *
 * Job OTPs are derived, not stored: HMAC-SHA-256 of the booking id under a
 * server secret. The tracking page re-derives the code for display, so no
 * raw OTP is ever persisted (AGENTS.md 5). The dispatch phase generates
 * start/complete OTPs with deriveJobOtp when a worker accepts.
 *
 * The worker check code lets the customer confirm at the door that the person
 * is the assigned worker: the worker's app shows the same derived code.
 */
import { createHmac } from 'node:crypto';
import { JOB_OTP_DIGITS } from '../otp';

export type JobOtpKind = 'start' | 'complete';

export const WORKER_CHECK_CODE_DIGITS = 6;
const MIN_SECRET_LENGTH = 32;

function derivedDigits(secret: string, message: string, digits: number): string {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new RangeError(`code secret must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  const value = createHmac('sha256', secret).update(message).digest().readUInt32BE(0);
  return String(value % 10 ** digits).padStart(digits, '0');
}

export function deriveJobOtp(secret: string, bookingId: string, kind: JobOtpKind): string {
  return derivedDigits(secret, `job-otp:v1:${kind}:${bookingId}`, JOB_OTP_DIGITS);
}

export interface WorkerCheckInput {
  bookingId: string;
  workerId: string;
  /** worker.qr_key_version: bumping it changes every code for that worker. */
  keyVersion: number;
}

export function workerCheckCode(secret: string, input: WorkerCheckInput): string {
  return derivedDigits(
    secret,
    `worker-check:v1:${input.bookingId}:${input.workerId}:${input.keyVersion}`,
    WORKER_CHECK_CODE_DIGITS,
  );
}
