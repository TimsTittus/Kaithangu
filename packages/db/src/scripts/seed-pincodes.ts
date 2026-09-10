/**
 * Import India Post pincodes for every state in the `states` table from
 * data/raw/pincodes.csv (bun run db:seed:pincodes). The CSV's state name is
 * matched against the English name in the i18n catalog (`state.<code>`).
 * Re-running replaces that state's rows. Coordinates come only from the file.
 */
import { fileURLToPath } from 'node:url';
import { getMessage } from '@kaithangu/i18n';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../client';
import { pincodes, states } from '../schema';
import { parsePincodeCsv, readPincodeCsv } from '../seed/pincodes';

const CSV_PATH = fileURLToPath(new URL('../../../../data/raw/pincodes.csv', import.meta.url));
// Rows geocoded further than this from their district's median point are dropped.
const MAX_DISTRICT_OFFSET_M = 50_000;
const INSERT_BATCH = 1000;

async function main(): Promise<void> {
  const databaseUrl = z
    .url({ protocol: /^postgres(ql)?$/ })
    .parse(process.env.DATABASE_URL, { error: () => 'DATABASE_URL must be a postgres URL' });
  const csv = readPincodeCsv(CSV_PATH);
  const { db, client } = createDb(databaseUrl, { max: 1 });
  try {
    for (const { code } of await db.select({ code: states.code }).from(states)) {
      const name = getMessage('en', `state.${code}`);
      if (name === undefined) {
        console.warn(`skipping ${code}: no English name at state.${code}`);
        continue;
      }
      const stateName = name.toUpperCase();
      const { rows, report } = parsePincodeCsv(csv, stateName, MAX_DISTRICT_OFFSET_M);
      await db.transaction(async (tx) => {
        await tx.delete(pincodes).where(eq(pincodes.stateName, stateName));
        for (let start = 0; start < rows.length; start += INSERT_BATCH) {
          await tx.insert(pincodes).values(rows.slice(start, start + INSERT_BATCH));
        }
      });
      console.log(`${code} (${stateName}): ${JSON.stringify(report)}`);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
