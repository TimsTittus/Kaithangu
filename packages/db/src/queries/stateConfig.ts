import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import { stateConfig } from '../schema';

/** state_config.default_locale for a state, or null when the state is not configured. */
export async function loadStateDefaultLocale(
  db: Database,
  stateCode: string,
): Promise<string | null> {
  const [row] = await db
    .select({ defaultLocale: stateConfig.defaultLocale })
    .from(stateConfig)
    .where(eq(stateConfig.stateCode, stateCode))
    .limit(1);
  return row?.defaultLocale ?? null;
}
