/**
 * Corporate queries: society dashboard aggregates, corporate profile,
 * recent bookings, and worker verification / revocation (compare-and-set).
 */
import type {
  CorporateBookingSummary,
  CorporateDashboardData,
  CorporateProfileData,
  CorporateRepo,
} from '@/lib/core';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '..';
import { bookings, corporate, societies, states, worker, workerSkills } from '../schema';

export type {
  CorporateBookingSummary,
  CorporateDashboardData,
  CorporateProfileData,
  CorporateRepo,
};

function formatTradeName(code: string): string {
  return code
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function createCorporateRepo(db: Database): CorporateRepo {
  return {
    async dashboard(corporateId: string, societyId: string | null) {
      const [corp] = await db
        .select({
          id: corporate.id,
          name: corporate.name,
          phone: corporate.phone,
          societyId: corporate.societyId,
        })
        .from(corporate)
        .where(eq(corporate.id, corporateId))
        .limit(1);

      const effectiveSocietyId = societyId ?? corp?.societyId ?? null;

      if (!effectiveSocietyId) {
        return {
          id: corp?.id ?? corporateId,
          name: corp?.name ?? null,
          phone: corp?.phone ?? '',
          role: 'corporate' as const,
          societyId: null,
          societyName: null,
          workerCount: 0,
          enrolmentCount: 0,
          welfareFundPaise: 0,
          schemes: [],
        };
      }

      const [soc] = await db
        .select({ name: societies.name })
        .from(societies)
        .where(eq(societies.id, effectiveSocietyId))
        .limit(1);

      const [workerCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(worker)
        .where(eq(worker.societyId, effectiveSocietyId));

      const [verifiedCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(worker)
        .where(and(eq(worker.societyId, effectiveSocietyId), eq(worker.status, 'verified')));

      const [welfareSumRow] = await db
        .select({ total: sql<string>`coalesce(sum(${bookings.welfarePaise}), 0)` })
        .from(bookings)
        .where(and(eq(bookings.societyId, effectiveSocietyId), ne(bookings.status, 'cancelled')));

      let schemes = (
        await db
          .select({
            code: workerSkills.tradeCode,
            enrolled: sql<number>`count(distinct ${workerSkills.workerId})::int`,
          })
          .from(workerSkills)
          .innerJoin(worker, eq(worker.id, workerSkills.workerId))
          .where(eq(worker.societyId, effectiveSocietyId))
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
            .where(eq(bookings.societyId, effectiveSocietyId))
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
        societyId: effectiveSocietyId,
        societyName: soc?.name ?? null,
        workerCount: Number(workerCountRow?.count ?? 0),
        enrolmentCount: Number(verifiedCountRow?.count ?? 0),
        welfareFundPaise: Number(welfareSumRow?.total ?? 0),
        schemes,
      };
    },

    async profile(corporateId: string) {
      const [row] = await db
        .select({
          id: corporate.id,
          name: corporate.name,
          phone: corporate.phone,
          societyId: corporate.societyId,
          societyName: societies.name,
          stateCode: societies.stateCode,
          societyCreatedAt: societies.createdAt,
          stateNameKey: states.nameKey,
        })
        .from(corporate)
        .leftJoin(societies, eq(societies.id, corporate.societyId))
        .leftJoin(states, eq(states.code, societies.stateCode))
        .where(eq(corporate.id, corporateId))
        .limit(1);

      if (!row) return null;

      let workerCount = 0;
      let enrolmentCount = 0;
      let welfareFundPaise = 0;

      if (row.societyId) {
        const [wc] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(worker)
          .where(eq(worker.societyId, row.societyId));
        const [vc] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(worker)
          .where(and(eq(worker.societyId, row.societyId), eq(worker.status, 'verified')));
        const [wf] = await db
          .select({ total: sql<string>`coalesce(sum(${bookings.welfarePaise}), 0)` })
          .from(bookings)
          .where(and(eq(bookings.societyId, row.societyId), ne(bookings.status, 'cancelled')));

        workerCount = Number(wc?.count ?? 0);
        enrolmentCount = Number(vc?.count ?? 0);
        welfareFundPaise = Number(wf?.total ?? 0);
      }

      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        societyId: row.societyId,
        societyName: row.societyName,
        stateCode: row.stateCode,
        stateNameKey: row.stateNameKey,
        societyCreatedAt: row.societyCreatedAt,
        workerCount,
        enrolmentCount,
        welfareFundPaise,
      };
    },

    async recentBookings(societyId: string, limit = 10) {
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
        .where(eq(bookings.societyId, societyId))
        .orderBy(desc(bookings.createdAt))
        .limit(limit);

      return rows;
    },

    async verifyWorker(workerId: string, societyId: string) {
      const updated = await db
        .update(worker)
        .set({ status: 'verified' })
        .where(
          and(
            eq(worker.id, workerId),
            eq(worker.societyId, societyId),
            eq(worker.status, 'pending'),
          ),
        )
        .returning({ id: worker.id });

      if (updated.length > 0) {
        await db
          .update(workerSkills)
          .set({ verified: true })
          .where(eq(workerSkills.workerId, workerId));
        return true;
      }
      return false;
    },

    async revokeWorker(workerId: string, societyId: string) {
      const updated = await db
        .update(worker)
        .set({ status: 'pending' })
        .where(
          and(
            eq(worker.id, workerId),
            eq(worker.societyId, societyId),
            eq(worker.status, 'verified'),
          ),
        )
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
