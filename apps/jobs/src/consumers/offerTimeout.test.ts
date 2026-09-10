import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createOfferTimeoutHandler, offerTimeoutJobSchema } from './offerTimeout';

describe('offerTimeoutJobSchema', () => {
  it('accepts a well-formed payload', () => {
    expect(offerTimeoutJobSchema.safeParse({ offerId: randomUUID() }).success).toBe(true);
  });

  it('rejects a malformed payload', () => {
    expect(offerTimeoutJobSchema.safeParse({ offerId: 'nope' }).success).toBe(false);
  });
});

describe('createOfferTimeoutHandler', () => {
  it('delegates to dispatch.handleOfferTimeout, and a repeated call is a no-op on the dispatch side', async () => {
    const handleOfferTimeout = vi.fn().mockResolvedValue(undefined);
    const handler = createOfferTimeoutHandler({ handleOfferTimeout });

    await handler({ offerId: 'offer-1' });
    await handler({ offerId: 'offer-1' });

    // Idempotency itself is a CAS inside dispatch.handleOfferTimeout (tested
    // in packages/core); this only checks the consumer wires the call through
    // unconditionally both times, never throwing on redelivery.
    expect(handleOfferTimeout).toHaveBeenCalledTimes(2);
    expect(handleOfferTimeout).toHaveBeenCalledWith('offer-1');
  });
});
