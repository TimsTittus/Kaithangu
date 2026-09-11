import type { Role, SessionUser, UpsertLoginInput, UserRepo } from '@/lib/core';
import type { Locale } from '@/lib/i18n';
import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '..';
import { institutions, societies, users, workers } from '../schema';

const uuid = z.uuid();

/** users joined with the rows that give the actor its scope ids. */
function selectSessionUser(db: Database) {
  return db
    .select({
      id: users.id,
      phone: users.phone,
      name: users.name,
      role: users.role,
      locale: users.locale,
      sessionVersion: users.sessionVersion,
      stateCode: users.stateCode,
      societyId: societies.id,
      societyStateCode: societies.stateCode,
      institutionId: institutions.id,
      institutionStateCode: institutions.stateCode,
    })
    .from(users)
    .leftJoin(workers, eq(workers.userId, users.id))
    .leftJoin(
      societies,
      // A worker belongs to workers.society_id; an LCS admin to users.society_id.
      or(
        and(isNotNull(workers.societyId), eq(societies.id, workers.societyId)),
        and(isNull(workers.societyId), eq(societies.id, users.societyId)),
      ),
    )
    .leftJoin(institutions, eq(institutions.id, users.institutionId));
}

export function createUserRepo(db: Database): UserRepo {
  async function findSessionUser(userId: string): Promise<SessionUser | null> {
    if (!uuid.safeParse(userId).success) return null;
    const [row] = await selectSessionUser(db).where(eq(users.id, userId)).limit(1);
    return row ?? null;
  }

  async function touch(phone: string, at: Date, role?: Role): Promise<string | undefined> {
    const [row] = await db
      .update(users)
      .set(role !== undefined ? { lastLoginAt: at, role } : { lastLoginAt: at })
      .where(eq(users.phone, phone))
      .returning({ id: users.id });
    return row?.id;
  }

  return {
    findSessionUser,

    async upsertOnLogin({ phone, locale, stateCode, at, role }: UpsertLoginInput) {
      let created = false;
      let id = await touch(phone, at, role);
      if (id === undefined) {
        const [inserted] = await db
          .insert(users)
          .values({ phone, role: role ?? 'user', locale, stateCode, lastLoginAt: at })
          .onConflictDoNothing({ target: users.phone })
          .returning({ id: users.id });
        created = inserted !== undefined;
        // Lost a race with a concurrent first sign-in: the row exists now.
        id = inserted?.id ?? (await touch(phone, at, role));
      }
      const user = id === undefined ? null : await findSessionUser(id);
      if (user === null) throw new Error('upsertOnLogin: user row not found after upsert');
      return { user, created };
    },

    async bumpSessionVersion(userId: string) {
      if (!uuid.safeParse(userId).success) return null;
      const [row] = await db
        .update(users)
        .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, userId))
        .returning({ sessionVersion: users.sessionVersion });
      return row?.sessionVersion ?? null;
    },

    async setLocale(userId: string, locale: Locale) {
      if (!uuid.safeParse(userId).success) return;
      await db.update(users).set({ locale }).where(eq(users.id, userId));
    },
  };
}
