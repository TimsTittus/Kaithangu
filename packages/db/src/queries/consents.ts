import type { ConsentPurpose, ConsentRecordInput, ConsentRepo } from '@kaithangu/core';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { consents } from '../schema';

export function createConsentRepo(db: Database): ConsentRepo {
  return {
    async has(userId: string, purpose: ConsentPurpose, version: string) {
      const rows = await db
        .select({ id: consents.id })
        .from(consents)
        .where(
          and(
            eq(consents.userId, userId),
            eq(consents.purpose, purpose),
            eq(consents.version, version),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },

    async record({ userId, purpose, version, channel, evidence }: ConsentRecordInput) {
      await db.insert(consents).values({ userId, purpose, version, channel, evidence });
    },
  };
}
