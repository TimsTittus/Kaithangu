/**
 * Corporate queries: dashboard aggregates, corporate profile, recent bookings,
 * and worker verification / revocation (compare-and-set).
 */
import type { CorporateRepo } from '@/lib/core';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '..';
import { bookings, corporate, worker, workerSkills } from '../schema';

export type {
  CorporateBookingSummary,
  CorporateDashboardData,
  CorporateProfileData,
  CorporateRepo,
} from '@/lib/core';

function formatTradeName(code: string): string {
  return code
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function workerCounts(db: Database): Promise<{ workerCount: number; enrolmentCount: number }> {
  const [workerCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(worker);
  const [verifiedCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(worker)
    .where(eq(worker.status, 'verified'));
  return {
    workerCount: Number(workerCountRow?.count ?? 0),
    enrolmentCount: Number(verifiedCountRow?.count ?? 0),
  };
}

async function welfareFundPaise(db: Database): Promise<number> {
  const [welfareSumRow] = await db
    .select({ total: sql<string>`coalesce(sum(${bookings.welfarePaise}), 0)` })
    .from(bookings)
    .where(ne(bookings.status, 'cancelled'));
  return Number(welfareSumRow?.total ?? 0);
}

export function createCorporateRepo(db: Database): CorporateRepo {
  return {
    async dashboard(corporateId: string) {
      const [corp] = await db
        .select({
          id: corporate.id,
          name: corporate.name,
          phone: corporate.phone,
        })
        .from(corporate)
        .where(eq(corporate.id, corporateId))
        .limit(1);

      const { workerCount, enrolmentCount } = await workerCounts(db);
      const fund = await welfareFundPaise(db);

      let schemes = (
        await db
          .select({
            code: workerSkills.tradeCode,
            enrolled: sql<number>`count(distinct ${workerSkills.workerId})::int`,
          })
          .from(workerSkills)
          .innerJoin(worker, eq(worker.id, workerSkills.workerId))
          .groupBy(workerSkills.tradeCode)
          .orderBy(asc(workerSkills.tradeCode))
      ).map((r) => ({
        code: r.code,
        name: formatTradeName(r.code),
        enrolled: Number(r.enrolled),
      }));

      if (schemes.length === 0) {
        schemes = (
          await db
            .select({
              code: bookings.tradeCode,
              enrolled: sql<number>`count(${bookings.id})::int`,
            })
            .from(bookings)
            .groupBy(bookings.tradeCode)
            .orderBy(asc(bookings.tradeCode))
        ).map((r) => ({
          code: r.code,
          name: formatTradeName(r.code),
          enrolled: Number(r.enrolled),
        }));
      }

      return {
        id: corp?.id ?? corporateId,
        name: corp?.name ?? null,
        phone: corp?.phone ?? '',
        role: 'corporate' as const,
        workerCount,
        enrolmentCount,
        welfareFundPaise: fund,
        schemes,
      };
    },

    async profile(corporateId: string) {
      const [row] = await db
        .select({
          id: corporate.id,
          name: corporate.name,
          phone: corporate.phone,
        })
        .from(corporate)
        .where(eq(corporate.id, corporateId))
        .limit(1);

      if (!row) return null;

      const { workerCount, enrolmentCount } = await workerCounts(db);
      const fund = await welfareFundPaise(db);

      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        workerCount,
        enrolmentCount,
        welfareFundPaise: fund,
      };
    },

    async recentBookings(limit = 10) {
      const rows = await db
        .select({
          id: bookings.id,
          tradeCode: bookings.tradeCode,
          problemText: bookings.problemText,
          status: bookings.status,
          totalPaise: bookings.totalPaise,
          welfarePaise: bookings.welfarePaise,
          createdAt: bookings.createdAt,
          scheduledFor: bookings.scheduledFor,
          pincode: bookings.pincode,
        })
        .from(bookings)
        .orderBy(desc(bookings.createdAt))
        .limit(limit);

      return rows;
    },

    async verifyWorker(workerId: string) {
      const updated = await db
        .update(worker)
        .set({ status: 'verified' })
        .where(and(eq(worker.id, workerId), eq(worker.status, 'pending')))
        .returning({ id: worker.id });

      if (updated.length > 0) {
        await db.update(workerSkills).set({ verified: true }).where(eq(workerSkills.workerId, workerId));
        return true;
      }
      return false;
    },

    async revokeWorker(workerId: string) {
      const updated = await db
        .update(worker)
        .set({ status: 'pending' })
        .where(and(eq(worker.id, workerId), eq(worker.status, 'verified')))
        .returning({ id: worker.id });

      if (updated.length > 0) {
        await db
          .update(workerSkills)
          .set({ verified: false })
          .where(eq(workerSkills.workerId, workerId));
        return true;
      }
      return false;
    },
  };
}
