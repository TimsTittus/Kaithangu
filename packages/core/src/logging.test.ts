import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { buildLoggerOptions } from './logging';

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { logger: pino(buildLoggerOptions(), stream), lines };
}

describe('buildLoggerOptions', () => {
  it('masks phone numbers in messages, format arguments and objects', () => {
    const { logger, lines } = captureLogger();

    logger.info('call +919876543210');
    logger.info('sent otp to %s', '+919876543210');
    logger.info({ to: '+919876543210', nested: { from: '+919876543210' } }, 'sms');

    expect(lines).toHaveLength(3);
    expect(lines.join('')).not.toContain('9876543210');
    for (const line of lines) {
      expect(line).toContain('+********3210');
    }
  });

  // Regression: Fastify logs raw request objects, which are circular.
  it('handles circular objects and masks what they serialize to', () => {
    const { logger, lines } = captureLogger();
    const request: Record<string, unknown> = { url: '/ivr?caller=+919876543210' };
    request.self = request;
    request.list = [request];

    expect(() => logger.info({ req: request }, 'incoming request')).not.toThrow();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('+********3210');
    expect(lines[0]).not.toContain('9876543210');
  });

  it('respects the requested level and pretty flag', () => {
    const options = buildLoggerOptions({ level: 'warn' });
    expect(options.level).toBe('warn');
    expect(options.transport).toBeUndefined();
    expect(buildLoggerOptions({ pretty: true }).transport).toEqual({ target: 'pino-pretty' });
  });
});
