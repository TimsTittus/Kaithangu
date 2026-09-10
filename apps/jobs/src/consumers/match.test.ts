import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createMatchHandler, isDueNow, matchJobSchema } from './match';

describe('isDueNow', () => {
  const now = new Date('2026-09-10T00:00:00.000Z');

  it('is always due for an unscheduled (normal/emergency) booking', () => {
    expect(isDueNow(null, now)).toBe(true);
  });

  it('is due once within the 60-minute lead window', () => {
    expect(isDueNow(new Date(now.getTime() + 59 * 60_000).toISOString(), now)).toBe(true);
    expect(isDueNow(new Date(now.getTime() + 60 * 60_000).toISOString(), now)).toBe(true);
  });

  it('is not due more than 60 minutes out', () => {
    expect(isDueNow(new Date(now.getTime() + 61 * 60_000).toISOString(), now)).toBe(false);
  });
});

describe('matchJobSchema', () => {
  it('accepts a well-formed payload', () => {
    const result = matchJobSchema.safeParse({
      bookingId: randomUUID(),
      urgency: 'normal',
      scheduledFor: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed payload', () => {
    expect(matchJobSchema.safeParse({ bookingId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('createMatchHandler', () => {
  it('runs matching when due', async () => {
    const runMatching = vi.fn().mockResolvedValue(undefined);
    const handler = createMatchHandler({ runMatching }, () => new Date('2026-09-10T00:00:00.000Z'));
    await handler({ bookingId: 'b1', urgency: 'normal', scheduledFor: null });
    expect(runMatching).toHaveBeenCalledWith('b1');
  });

  it('does not run matching for a booking still far in the future', async () => {
    const runMatching = vi.fn().mockResolvedValue(undefined);
    const now = new Date('2026-09-10T00:00:00.000Z');
    const handler = createMatchHandler({ runMatching }, () => now);
    await handler({
      bookingId: 'b1',
      urgency: 'normal',
      scheduledFor: new Date(now.getTime() + 2 * 60 * 60_000).toISOString(),
    });
    expect(runMatching).not.toHaveBeenCalled();
  });
});
