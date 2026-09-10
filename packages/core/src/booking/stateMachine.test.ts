import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import {
  allowedNext,
  assertTransition,
  BOOKING_STATUSES,
  canTransition,
  isBookingStatus,
} from './stateMachine';

// AGENTS.md 6.5, written out independently of the implementation's table.
const LEGAL = new Set([
  'requested>matching',
  'matching>offered',
  'offered>accepted',
  'accepted>en_route',
  'en_route>in_progress',
  'in_progress>completed',
  'matching>unassigned',
  'offered>unassigned',
  'unassigned>offered',
  'requested>cancelled',
  'matching>cancelled',
  'offered>cancelled',
  'unassigned>cancelled',
  'accepted>cancelled',
  'en_route>cancelled',
  'completed>disputed',
  'disputed>resolved',
]);

const ALL_PAIRS = BOOKING_STATUSES.flatMap((from) =>
  BOOKING_STATUSES.map((to) => [from, to] as const),
);

describe('booking state machine', () => {
  it('has the eleven statuses of the booking_status enum', () => {
    expect(BOOKING_STATUSES).toEqual([
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
    expect(isBookingStatus('offered')).toBe(true);
    expect(isBookingStatus('paid')).toBe(false);
  });

  it('covers the full 11 × 11 matrix', () => {
    expect(ALL_PAIRS).toHaveLength(121);
  });

  it.each(ALL_PAIRS.filter(([from, to]) => LEGAL.has(`${from}>${to}`)))(
    'allows %s → %s',
    (from, to) => {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
      expect(allowedNext(from)).toContain(to);
    },
  );

  it.each(ALL_PAIRS.filter(([from, to]) => !LEGAL.has(`${from}>${to}`)))(
    'rejects %s → %s with INVALID_TRANSITION',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
      expect(allowedNext(from)).not.toContain(to);
      try {
        assertTransition(from, to);
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe('INVALID_TRANSITION');
        expect(appError.httpStatus).toBe(409);
        expect(appError.details).toEqual({ from, to });
      }
    },
  );

  it('has exactly the legal transitions listed in AGENTS.md 6.5', () => {
    const count = BOOKING_STATUSES.reduce((n, s) => n + allowedNext(s).length, 0);
    expect(count).toBe(LEGAL.size);
    expect(allowedNext('cancelled')).toEqual([]);
    expect(allowedNext('resolved')).toEqual([]);
  });
});
