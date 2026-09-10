/**
 * `offer-timeout` consumer (AGENTS.md 6.4). Fed by the offer-timeout-delay
 * queue (fixed TTL = OFFER_TIMEOUT_SECONDS). dispatch.handleOfferTimeout is a
 * compare-and-set (offer response NULL -> 'timeout'), so redelivery or a
 * timeout that lost the race to an accept/decline is a safe no-op —
 * satisfies "processing the same offer-timeout job twice has no double
 * effect" directly, with no extra idempotency bookkeeping needed here.
 */
import type { DispatchService } from '@kaithangu/core';
import { z } from 'zod';

export const offerTimeoutJobSchema = z.object({ offerId: z.uuid() });
export type OfferTimeoutJobPayload = z.infer<typeof offerTimeoutJobSchema>;

export function createOfferTimeoutHandler(dispatch: Pick<DispatchService, 'handleOfferTimeout'>) {
  return async (payload: OfferTimeoutJobPayload): Promise<void> => {
    await dispatch.handleOfferTimeout(payload.offerId);
  };
}
