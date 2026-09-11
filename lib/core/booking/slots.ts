/**
 * Scheduled-booking slots (Phase 5): the next 7 local calendar days (today
 * included), 2-hour slots from 07:00 to 19:00 in the state's timezone. A slot
 * must start at least 60 minutes from now, because matching starts 60 minutes
 * before scheduled_for (AGENTS.md 6.4).
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const SLOT_START_HOURS = [7, 9, 11, 13, 15, 17] as const;
export const SLOT_LENGTH_HOURS = 2;
export const SLOT_DAYS = 7;
export const SLOT_MIN_LEAD_MINUTES = 60;

/** Start instants of every bookable slot, in order. */
export function bookableSlots(now: Date, timeZone: string): Date[] {
  const [year = NaN, month = NaN, day = NaN] = formatInTimeZone(now, timeZone, 'yyyy-MM-dd')
    .split('-')
    .map(Number);
  const earliest = now.getTime() + SLOT_MIN_LEAD_MINUTES * 60_000;
  const slots: Date[] = [];
  for (let offset = 0; offset < SLOT_DAYS; offset += 1) {
    // Calendar arithmetic on a UTC date: no timezone or DST involved.
    const date = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
    for (const hour of SLOT_START_HOURS) {
      const start = fromZonedTime(`${date}T${String(hour).padStart(2, '0')}:00:00`, timeZone);
      if (start.getTime() >= earliest) slots.push(start);
    }
  }
  return slots;
}

export function isBookableSlot(start: Date, now: Date, timeZone: string): boolean {
  const time = start.getTime();
  return bookableSlots(now, timeZone).some((slot) => slot.getTime() === time);
}
