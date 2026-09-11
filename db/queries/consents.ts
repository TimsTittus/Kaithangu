import type { ConsentPurpose, ConsentRecordInput, ConsentRepo, Role } from '@/lib/core';
import { and, eq } from 'drizzle-orm';
import type { Database } from '..';
import { consents } from '../schema';

export function createConsentRepo(db: Database): ConsentRepo {
  return {
    async has(actorRole: Role, actorId: string, purpose: ConsentPurpose, version: string) {
      const rows = await db
        .select({ id: consents.id })
        .from(consents)
        .where(
          and(
            eq(consents.actorRole, actorRole),
            eq(consents.actorId, actorId),
            eq(consents.purpose, purpose),
            eq(consents.version, version),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },

    async record({ actorRole, actorId, purpose, version, evidence }: ConsentRecordInput) {
      await db.insert(consents).values({ actorRole, actorId, purpose, version, evidence });
    },
  };
}
