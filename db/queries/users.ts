import {
  AppError,
  type Role,
  type SessionUser,
  type UpsertLoginInput,
  type UserRepo,
} from '@/lib/core';
import type { Locale } from '@/lib/i18n';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '..';
import { corporate, societies, user, worker } from '../schema';

const uuid = z.uuid();

type IdentityRow = {
  id: string;
  phone: string;
  name: string | null;
  locale: string | null;
  sessionVersion: number;
  stateCode: string | null;
  societyId: string | null;
  societyStateCode: string | null;
};

function toSessionUser(row: IdentityRow, role: Role): SessionUser {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    role,
    locale: row.locale,
    sessionVersion: row.sessionVersion,
    stateCode: role === 'user' ? row.stateCode : row.societyStateCode,
    societyId: role === 'user' ? null : row.societyId,
    societyStateCode: role === 'user' ? null : row.societyStateCode,
  };
}

export function createUserRepo(db: Database): UserRepo {
  async function loadUser(id: string): Promise<IdentityRow | undefined> {
    const [row] = await db
      .select({
        id: user.id,
        phone: user.phone,
        name: user.name,
        locale: user.locale,
        sessionVersion: user.sessionVersion,
        stateCode: user.stateCode,
        societyId: sql<string | null>`null`,
        societyStateCode: sql<string | null>`null`,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return row;
  }

  async function loadWorker(id: string): Promise<IdentityRow | undefined> {
    const [row] = await db
      .select({
        id: worker.id,
        phone: worker.phone,
        name: worker.name,
        locale: worker.locale,
        sessionVersion: worker.sessionVersion,
        stateCode: sql<string | null>`null`,
        societyId: worker.societyId,
        societyStateCode: societies.stateCode,
      })
      .from(worker)
      .leftJoin(societies, eq(societies.id, worker.societyId))
      .where(eq(worker.id, id))
      .limit(1);
    return row;
  }

  async function loadCorporate(id: string): Promise<IdentityRow | undefined> {
    const [row] = await db
      .select({
        id: corporate.id,
        phone: corporate.phone,
        name: corporate.name,
        locale: corporate.locale,
        sessionVersion: corporate.sessionVersion,
        stateCode: sql<string | null>`null`,
        societyId: corporate.societyId,
        societyStateCode: societies.stateCode,
      })
      .from(corporate)
      .leftJoin(societies, eq(societies.id, corporate.societyId))
      .where(eq(corporate.id, id))
      .limit(1);
    return row;
  }

  async function loadById(id: string, role: Role): Promise<SessionUser | null> {
    if (!uuid.safeParse(id).success) return null;
    const row =
      role === 'user'
        ? await loadUser(id)
        : role === 'worker'
          ? await loadWorker(id)
          : await loadCorporate(id);
    return row === undefined ? null : toSessionUser(row, role);
  }

  async function findPhoneRole(phone: string): Promise<Role | null> {
    const [customer] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.phone, phone))
      .limit(1);
    if (customer !== undefined) return 'user';
    const [asWorker] = await db
      .select({ id: worker.id })
      .from(worker)
      .where(eq(worker.phone, phone))
      .limit(1);
    if (asWorker !== undefined) return 'worker';
    const [asCorporate] = await db
      .select({ id: corporate.id })
      .from(corporate)
      .where(eq(corporate.phone, phone))
      .limit(1);
    if (asCorporate !== undefined) return 'corporate';
    return null;
  }

  async function findIdByPhone(phone: string, role: Role): Promise<string | undefined> {
    if (role === 'user') {
      const [row] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.phone, phone))
        .limit(1);
      return row?.id;
    }
    if (role === 'worker') {
      const [row] = await db
        .select({ id: worker.id })
        .from(worker)
        .where(eq(worker.phone, phone))
        .limit(1);
      return row?.id;
    }
    const [row] = await db
      .select({ id: corporate.id })
      .from(corporate)
      .where(eq(corporate.phone, phone))
      .limit(1);
    return row?.id;
  }

  async function insertIdentity({
    phone,
    locale,
    stateCode,
    role,
  }: UpsertLoginInput): Promise<string | undefined> {
    if (role === 'user') {
      const [inserted] = await db
        .insert(user)
        .values({ phone, locale, stateCode })
        .onConflictDoNothing({ target: user.phone })
        .returning({ id: user.id });
      return inserted?.id;
    }
    if (role === 'worker') {
      const [inserted] = await db
        .insert(worker)
        .values({ phone, locale })
        .onConflictDoNothing({ target: worker.phone })
        .returning({ id: worker.id });
      return inserted?.id;
    }
    const [inserted] = await db
      .insert(corporate)
      .values({ phone, locale })
      .onConflictDoNothing({ target: corporate.phone })
      .returning({ id: corporate.id });
    return inserted?.id;
  }

  return {
    async findSessionUser(userId, role) {
      return loadById(userId, role);
    },

    async upsertOnLogin(input) {
      const existingRole = await findPhoneRole(input.phone);
      if (existingRole !== null && existingRole !== input.role) {
        throw new AppError('CONFLICT', undefined, undefined, { existingRole });
      }
      let created = false;
      let id =
        existingRole === input.role ? await findIdByPhone(input.phone, input.role) : undefined;
      if (id === undefined) {
        const inserted = await insertIdentity(input);
        created = inserted !== undefined;
        id = inserted ?? (await findIdByPhone(input.phone, input.role));
      }
      const userRow = id === undefined ? null : await loadById(id, input.role);
      if (userRow === null) throw new Error('upsertOnLogin: identity row not found after upsert');
      return { user: userRow, created };
    },

    async bumpSessionVersion(userId, role) {
      if (!uuid.safeParse(userId).success) return null;
      if (role === 'user') {
        const [row] = await db
          .update(user)
          .set({ sessionVersion: sql`${user.sessionVersion} + 1` })
          .where(eq(user.id, userId))
          .returning({ sessionVersion: user.sessionVersion });
        return row?.sessionVersion ?? null;
      }
      if (role === 'worker') {
        const [row] = await db
          .update(worker)
          .set({ sessionVersion: sql`${worker.sessionVersion} + 1` })
          .where(eq(worker.id, userId))
          .returning({ sessionVersion: worker.sessionVersion });
        return row?.sessionVersion ?? null;
      }
      const [row] = await db
        .update(corporate)
        .set({ sessionVersion: sql`${corporate.sessionVersion} + 1` })
        .where(eq(corporate.id, userId))
        .returning({ sessionVersion: corporate.sessionVersion });
      return row?.sessionVersion ?? null;
    },

    async setLocale(userId, role, locale: Locale) {
      if (!uuid.safeParse(userId).success) return;
      if (role === 'user') {
        await db.update(user).set({ locale }).where(eq(user.id, userId));
        return;
      }
      if (role === 'worker') {
        await db.update(worker).set({ locale }).where(eq(worker.id, userId));
        return;
      }
      await db.update(corporate).set({ locale }).where(eq(corporate.id, userId));
    },
  };
}
