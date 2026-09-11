/**
 * The worker's own status, availability and registered trades: what decides
 * whether they may see and take a job on the open board. Read by identity, so
 * no ScopeFilter applies — a worker only ever asks about themselves.
 */
import type { TradeCode, WorkerEligibility, WorkerEligibilityRepo } from '@/lib/core';
import { eq } from 'drizzle-orm';
import type { Database } from '..';
import { worker, workerSkills } from '../schema';

export function createWorkerEligibilityRepo(db: Database): WorkerEligibilityRepo {
  return {
    async eligibility(workerId: string): Promise<WorkerEligibility | null> {
      const [row] = await db
        .select({
          status: worker.status,
          available: worker.available,
        })
        .from(worker)
        .where(eq(worker.id, workerId))
        .limit(1);
      if (row === undefined) return null;

      const skills = await db
        .select({ tradeCode: workerSkills.tradeCode, certified: workerSkills.certified })
        .from(workerSkills)
        .where(eq(workerSkills.workerId, workerId));

      return {
        ...row,
        skills: skills.map((skill) => ({
          tradeCode: skill.tradeCode as TradeCode,
          certified: skill.certified,
        })),
      };
    },
  };
}
