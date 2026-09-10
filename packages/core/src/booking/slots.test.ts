import { formatInTimeZone } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { bookableSlots, isBookableSlot, SLOT_DAYS, SLOT_START_HOURS } from './slots';

const IST = 'Asia/Kolkata';
const at = (iso: string) => new Date(iso);

describe('bookableSlots', () => {
  it('offers 2-hour slots 07:00–19:00 local, at least 60 minutes ahead, for 7 days', () => {
    const now = at('2026-09-10T03:30:00Z'); // 09:00 IST
    const slots = bookableSlots(now, IST);
    // Today: 07:00 is past and 09:00 is less than 60 minutes away.
    expect(slots).toHaveLength(4 + (SLOT_DAYS - 1) * SLOT_START_HOURS.length);
    expect(slots[0]?.toISOString()).toBe('2026-09-10T05:30:00.000Z'); // 11:00 IST
    expect(slots.at(-1)?.toISOString()).toBe('2026-09-16T11:30:00.000Z'); // 17:00 IST, day 7
    for (const slot of slots) {
      const hour = Number(formatInTimeZone(slot, IST, 'H'));
      expect(SLOT_START_HOURS).toContain(hour);
      expect(formatInTimeZone(slot, IST, 'mm')).toBe('00');
      expect(slot.getTime() - now.getTime()).toBeGreaterThanOrEqual(60 * 60_000);
    }
  });

  it('starts at tomorrow once today is over', () => {
    const slots = bookableSlots(at('2026-09-10T13:00:00Z'), IST); // 18:30 IST
    expect(slots).toHaveLength((SLOT_DAYS - 1) * SLOT_START_HOURS.length);
    expect(formatInTimeZone(slots[0] ?? new Date(0), IST, 'yyyy-MM-dd HH:mm')).toBe(
      '2026-09-11 07:00',
    );
  });

  it('uses the given timezone, including across month ends', () => {
    const slots = bookableSlots(at('2026-09-30T00:00:00Z'), 'UTC');
    expect(slots[0]?.toISOString()).toBe('2026-09-30T07:00:00.000Z');
    expect(slots.at(-1)?.toISOString()).toBe('2026-10-06T17:00:00.000Z');
  });
});

describe('isBookableSlot', () => {
  const now = at('2026-09-10T03:30:00Z');

  it('accepts exactly the offered slot starts', () => {
    expect(isBookableSlot(at('2026-09-10T05:30:00Z'), now, IST)).toBe(true);
    expect(isBookableSlot(at('2026-09-16T11:30:00Z'), now, IST)).toBe(true);
  });

  it('rejects too-soon, off-grid and out-of-range times', () => {
    expect(isBookableSlot(at('2026-09-10T03:30:00Z'), now, IST)).toBe(false); // 09:00 IST, now
    expect(isBookableSlot(at('2026-09-10T06:00:00Z'), now, IST)).toBe(false); // 11:30 IST
    expect(isBookableSlot(at('2026-09-10T13:30:00Z'), now, IST)).toBe(false); // 19:00 IST
    expect(isBookableSlot(at('2026-09-17T01:30:00Z'), now, IST)).toBe(false); // day 8
  });
});
