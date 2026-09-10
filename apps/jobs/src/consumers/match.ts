/**
 * `match` consumer (AGENTS.md 6.4). Runs matching now, unless the booking is
 * scheduled more than SCHEDULED_MATCH_LEAD_MINUTES out — then it no-ops and
 * relies on the scheduled-match scanner to re-publish this job once it's
 * within the window (see ../scheduledMatch.ts for why a poll, not a delay
 * queue). Idempotent: dispatch.runMatching itself CAS-transitions the
 * booking, so redelivery or a late scheduled-match re-publish is a no-op.
 */
import { SCHEDULED_MATCH_LEAD_MINUTES, type DispatchService } from '@kaithangu/core';
import { z } from 'zod';

export const matchJobSchema = z.object({
  bookingId: z.uuid(),
  urgency: z.enum(['normal', 'emergency']),
  scheduledFor: z.iso.datetime({ offset: true }).nullable(),
});
export type MatchJobPayload = z.infer<typeof matchJobSchema>;

export function isDueNow(scheduledFor: string | null, now: Date): boolean {
  if (scheduledFor === null) return true;
  const leadMs = SCHEDULED_MATCH_LEAD_MINUTES * 60 * 1000;
  return new Date(scheduledFor).getTime() - now.getTime() <= leadMs;
}

export function createMatchHandler(
  dispatch: Pick<DispatchService, 'runMatching'>,
  now: () => Date = () => new Date(),
) {
  return async (payload: MatchJobPayload): Promise<void> => {
    if (!isDueNow(payload.scheduledFor, now())) return;
    await dispatch.runMatching(payload.bookingId);
  };
}
