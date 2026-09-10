import { describe, expect, it } from 'vitest';
import { AppError, DEFAULT_HTTP_STATUS, ERROR_CODES, errorMessageKey, isAppError } from './errors';

describe('AppError', () => {
  it('defaults httpStatus and messageKey from the code', () => {
    const error = new AppError('INVALID_PHONE');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.code).toBe('INVALID_PHONE');
    expect(error.httpStatus).toBe(400);
    expect(error.messageKey).toBe('error.INVALID_PHONE');
    expect(error.details).toBeUndefined();
  });

  it('keeps explicit httpStatus, messageKey and details', () => {
    const error = new AppError('CONFLICT', 422, 'booking.already_taken', { bookingId: 'b1' });
    expect(error.httpStatus).toBe(422);
    expect(error.messageKey).toBe('booking.already_taken');
    expect(error.details).toEqual({ bookingId: 'b1' });
  });

  it('has a default status for every code', () => {
    for (const code of ERROR_CODES) {
      expect(DEFAULT_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(errorMessageKey(code)).toBe(`error.${code}`);
    }
  });

  it('isAppError distinguishes AppError from other errors', () => {
    expect(isAppError(new AppError('INTERNAL'))).toBe(true);
    expect(isAppError(new Error('boom'))).toBe(false);
    expect(isAppError('INTERNAL')).toBe(false);
  });
});
