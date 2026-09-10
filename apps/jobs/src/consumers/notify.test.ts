import { randomUUID } from 'node:crypto';
import type { Channel } from 'amqplib';
import type { Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createNotifyHandler, notifyJobSchema } from './notify';

function fakeChannel() {
  const sendToQueue = vi.fn();
  const channel = { sendToQueue } as unknown as Channel;
  return { channel, sendToQueue };
}

function fakeLogger() {
  return { warn: vi.fn(), error: vi.fn() } as unknown as Logger;
}

const basePayload = {
  userId: 'u1',
  channel: 'sms' as const,
  kind: 'job_offer',
  bookingId: randomUUID(),
  titleKey: 'sms.job_offer',
  params: { trade: 'plumber' },
  locale: 'en' as const,
  phone: '+919900000000',
};

describe('notifyJobSchema', () => {
  it('defaults attempt to 1', () => {
    const result = notifyJobSchema.parse(basePayload);
    expect(result.attempt).toBe(1);
  });
});

describe('createNotifyHandler', () => {
  it('acks (returns normally) on a successful delivery, publishing nothing', async () => {
    const deliver = vi.fn().mockResolvedValue(undefined);
    const { channel, sendToQueue } = fakeChannel();
    const handler = createNotifyHandler({ deliver }, channel, fakeLogger());

    await handler({ ...basePayload, attempt: 1 });

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(sendToQueue).not.toHaveBeenCalled();
  });

  it('republishes to notify-retry with backoff and a bumped attempt on failure', async () => {
    const deliver = vi.fn().mockRejectedValue(new Error('sms provider down'));
    const { channel, sendToQueue } = fakeChannel();
    const logger = fakeLogger();
    const handler = createNotifyHandler({ deliver }, channel, logger);

    await handler({ ...basePayload, attempt: 1 });

    expect(sendToQueue).toHaveBeenCalledTimes(1);
    const [queue, buffer, options] = sendToQueue.mock.calls[0] as [
      string,
      Buffer,
      { expiration?: string },
    ];
    expect(queue).toBe('notify-retry');
    expect(JSON.parse(buffer.toString())).toMatchObject({ attempt: 2, kind: 'job_offer' });
    expect(Number(options.expiration)).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('gives up and logs (no republish) once the max attempt is reached', async () => {
    const deliver = vi.fn().mockRejectedValue(new Error('sms provider down'));
    const { channel, sendToQueue } = fakeChannel();
    const logger = fakeLogger();
    const handler = createNotifyHandler({ deliver }, channel, logger);

    await handler({ ...basePayload, attempt: 3 });

    expect(sendToQueue).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
