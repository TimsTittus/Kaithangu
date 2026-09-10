import { randomUUID } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import type { LoggerOptions } from 'pino';
import type { VoiceDeps } from './deps';
import type { VoiceEnv } from './env';
import { registerTwilioRoutes } from './twilio/routes';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export interface ServerOptions {
  logger: LoggerOptions | false;
  version: string;
  /** Registers the Twilio routes when provided; omitted in the health-check-only test. */
  voice?: { env: VoiceEnv; deps: VoiceDeps };
}

export function buildServer({ logger, version, voice }: ServerOptions) {
  const app = Fastify({
    logger,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    // Reuse a caller-supplied id so one call can be traced across web, voice
    // and jobs; anything malformed is replaced rather than logged verbatim.
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
        ? incoming
        : randomUUID();
    },
  });

  app.addHook('onRequest', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  app.get('/health', () => ({ ok: true, version }));

  if (voice) {
    registerTwilioRoutes(app, voice.env, voice.deps);
  }

  return app;
}
