import { EnvValidationError } from '@kaithangu/core';
import { getEnv } from './env';

// Node.js-only startup checks. Imported from instrumentation.ts only when
// NEXT_RUNTIME is 'nodejs', so the Edge bundle never sees process.exit.
try {
  getEnv();
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
