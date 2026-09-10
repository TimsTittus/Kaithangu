import { buildLoggerOptions, EnvValidationError } from '@kaithangu/core';
import packageJson from '../package.json' with { type: 'json' };
import { loadEnv } from './env';
import { buildServer } from './server';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = buildServer({
    logger: buildLoggerOptions({ pretty: env.NODE_ENV === 'development' }),
    version: packageJson.version,
  });

  let closing = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info({ signal }, 'voice server shutting down');
    try {
      // Stops accepting connections and waits for in-flight requests.
      await app.close();
      app.log.info('voice server stopped');
    } catch (error) {
      app.log.error({ err: error }, 'error during shutdown');
      process.exitCode = 1;
    }
  };
  process.once('SIGTERM', (signal) => void shutdown(signal));
  process.once('SIGINT', (signal) => void shutdown(signal));

  await app.listen({ port: env.VOICE_PORT, host: env.VOICE_HOST });
}

main().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    console.error(error.message);
  } else {
    console.error('voice server failed to start', error);
  }
  process.exit(1);
});
