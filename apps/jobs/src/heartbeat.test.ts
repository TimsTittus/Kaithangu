import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createHeartbeatPayload, handleHeartbeat } from './heartbeat';

function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  return { logger: pino(stream), lines };
}

describe('heartbeat', () => {
  it('logs a valid heartbeat with its lag', () => {
    const { logger, lines } = captureLogger();
    const sent = new Date('2026-09-10T00:00:00.000Z');
    const received = new Date('2026-09-10T00:00:00.250Z');

    expect(handleHeartbeat(createHeartbeatPayload(sent), logger, received)).toBe(true);
    expect(lines[0]).toMatchObject({ msg: 'heartbeat', queue: 'heartbeat', lagMs: 250 });
  });

  it('rejects non-JSON and schema-invalid payloads without throwing', () => {
    const { logger, lines } = captureLogger();

    expect(handleHeartbeat(Buffer.from('nope'), logger)).toBe(false);
    expect(handleHeartbeat(Buffer.from(JSON.stringify({ sentAt: 'yesterday' })), logger)).toBe(
      false,
    );
    expect(lines.map((line) => line.level)).toEqual([40, 40]);
  });
});
