/**
 * Booking state machine (AGENTS.md 6.5).
 *   requested → matching → offered → accepted → en_route → in_progress → completed
 *   matching|offered → unassigned → offered (manual assign)
 *   requested|matching|offered|unassigned|accepted|en_route → cancelled
 *   completed → disputed → resolved
 * Any other transition (including from == to) throws AppError('INVALID_TRANSITION').
 * Statuses match the booking_status enum in packages/db.
 */
import { AppError } from '../errors';

export const BOOKING_STATUSES = [
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
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  requested: ['matching', 'cancelled'],
  matching: ['offered', 'unassigned', 'cancelled'],
  offered: ['accepted', 'unassigned', 'cancelled'],
  accepted: ['en_route', 'cancelled'],
  en_route: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: ['disputed'],
  unassigned: ['offered', 'cancelled'],
  cancelled: [],
  disputed: ['resolved'],
  resolved: [],
};

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

/** Statuses reachable from `from` in one step. */
export function allowedNext(from: BookingStatus): readonly BookingStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError('INVALID_TRANSITION', undefined, undefined, { from, to });
  }
}
