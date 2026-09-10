/**
 * Application errors (AGENTS.md 4.4). Services throw AppError(code, httpStatus,
 * messageKey, details?); messageKey is an i18n key. Handlers map AppError to
 * responses; anything else is an unknown error (500 with requestId).
 * httpStatus and messageKey default per code, so `new AppError('INVALID_PHONE')`
 * is the common form.
 */

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INVALID_PHONE',
  'INVALID_TRANSITION',
  'OTP_INVALID',
  'OTP_LOCKED',
  'OTP_EXPIRED',
  'OTP_ATTEMPTS_EXCEEDED',
  'RATE_LIMITED',
  'CONSENT_REQUIRED',
  'NOT_CONFIGURED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const DEFAULT_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_PHONE: 400,
  INVALID_TRANSITION: 409,
  OTP_INVALID: 400,
  OTP_LOCKED: 423,
  OTP_EXPIRED: 400,
  OTP_ATTEMPTS_EXCEEDED: 429,
  RATE_LIMITED: 429,
  CONSENT_REQUIRED: 403,
  NOT_CONFIGURED: 503,
  INTERNAL: 500,
};

/** i18n key of the default message for an error code, e.g. `error.INVALID_PHONE`. */
export function errorMessageKey(code: ErrorCode): string {
  return `error.${code}`;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly messageKey: string;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: ErrorCode,
    httpStatus: number = DEFAULT_HTTP_STATUS[code],
    messageKey: string = errorMessageKey(code),
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(`${code} (${messageKey})`);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.messageKey = messageKey;
    this.details = details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return (
    value instanceof AppError ||
    (typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      value.name === 'AppError' &&
      'code' in value &&
      'httpStatus' in value &&
      'messageKey' in value)
  );
}
