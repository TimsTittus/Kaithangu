import type {
  TradeCode,
  WorkerOnboardingPatch,
  WorkerOnboardingRecord,
  WorkerOnboardingRepo,
} from '@/lib/core';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { Database } from '..';
import { worker, workerServiceAreas, workerSkills } from '../schema';

function asRadius(value: number | null): 2 | 5 | 10 | null {
  return value === 2 || value === 5 || value === 10 ? value : null;
}

function asLevel(value: number): 1 | 2 | 3 {
  if (value === 2 || value === 3) return value;
  return 1;
}

function toRecord(
  row: typeof worker.$inferSelect,
  skills: WorkerOnboardingRecord['skills'],
  serviceAreas: WorkerOnboardingRecord['serviceAreas'],
): WorkerOnboardingRecord {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    locale: row.locale,
    status: row.status,
    registrationStatus: row.registrationStatus,
    onboardingStep: row.onboardingStep,
    hasSmartphone: row.hasSmartphone,
    serviceRadiusKm: asRadius(row.serviceRadiusKm),
    availabilityDays: row.availabilityDays,
    availabilityHours: row.availabilityHours,
    upiId: row.upiId,
    certificationStatus: row.certificationStatus,
    consentDataUse: row.consentDataUse,
    consentRecordingRetention: row.consentRecordingRetention,
    fairnessExplained: row.fairnessExplained,
    identityVerifiedAt: row.identityVerifiedAt,
    submittedAt: row.submittedAt,
    lastInteractionId: row.lastInteractionId,
    skills,
    serviceAreas,
  };
}

async function loadSkills(
  db: Database,
  workerId: string,
): Promise<WorkerOnboardingRecord['skills']> {
  const rows = await db
    .select({
      tradeCode: workerSkills.tradeCode,
      level: workerSkills.level,
    })
    .from(workerSkills)
    .where(eq(workerSkills.workerId, workerId));
  return rows.map((row) => ({
    tradeCode: row.tradeCode as TradeCode,
    level: asLevel(row.level),
  }));
}

async function loadAreas(
  db: Database,
  workerId: string,
): Promise<WorkerOnboardingRecord['serviceAreas']> {
  const rows = await db
    .select({
      position: workerServiceAreas.position,
      pincode: workerServiceAreas.pincode,
      location: workerServiceAreas.location,
      needsFollowup: workerServiceAreas.needsFollowup,
    })
    .from(workerServiceAreas)
    .where(eq(workerServiceAreas.workerId, workerId));
  return rows.map((row) => ({
    position: row.position === 2 ? 2 : 1,
    pincode: row.pincode,
    location: row.location,
    needsFollowup: row.needsFollowup,
  }));
}

function profileColumns(patch: WorkerOnboardingPatch): Partial<typeof worker.$inferInsert> {
  const values: Partial<typeof worker.$inferInsert> = {};
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.locale !== undefined) values.locale = patch.locale;
  if (patch.hasSmartphone !== undefined) values.hasSmartphone = patch.hasSmartphone;
  if (patch.onboardingStep !== undefined) values.onboardingStep = patch.onboardingStep;
  if (patch.serviceRadiusKm !== undefined) values.serviceRadiusKm = patch.serviceRadiusKm;
  if (patch.availabilityDays !== undefined) values.availabilityDays = patch.availabilityDays;
  if (patch.availabilityHours !== undefined) values.availabilityHours = patch.availabilityHours;
  if (patch.upiId !== undefined) values.upiId = patch.upiId;
  if (patch.certificationStatus !== undefined)
    values.certificationStatus = patch.certificationStatus;
  if (patch.consentDataUse !== undefined) values.consentDataUse = patch.consentDataUse;
  if (patch.consentRecordingRetention !== undefined) {
    values.consentRecordingRetention = patch.consentRecordingRetention;
  }
  if (patch.fairnessExplained !== undefined) values.fairnessExplained = patch.fairnessExplained;
  if (patch.lastInteractionId !== undefined) values.lastInteractionId = patch.lastInteractionId;
  return values;
}

export function createWorkerOnboardingRepo(db: Database): WorkerOnboardingRepo {
  async function loadById(workerId: string): Promise<WorkerOnboardingRecord | null> {
    const [row] = await db.select().from(worker).where(eq(worker.id, workerId)).limit(1);
    if (row === undefined) return null;
    const [skills, serviceAreas] = await Promise.all([
      loadSkills(db, workerId),
      loadAreas(db, workerId),
    ]);
    return toRecord(row, skills, serviceAreas);
  }

  return {
    async findByPhone(phone) {
      const [row] = await db.select().from(worker).where(eq(worker.phone, phone)).limit(1);
      if (row === undefined) return null;
      const [skills, serviceAreas] = await Promise.all([
        loadSkills(db, row.id),
        loadAreas(db, row.id),
      ]);
      return toRecord(row, skills, serviceAreas);
    },

    async markIdentityVerified(workerId, at) {
      const current = await loadById(workerId);
      if (current === null) return;
      await db
        .update(worker)
        .set({
          identityVerifiedAt: current.identityVerifiedAt ?? at,
          onboardingStep: current.onboardingStep ?? 'name',
        })
        .where(eq(worker.id, workerId));
    },

    async markSubmitted(workerId, at) {
      const current = await loadById(workerId);
      if (current === null) return;
      await db
        .update(worker)
        .set({
          registrationStatus: 'submitted',
          submittedAt: current.submittedAt ?? at,
          onboardingStep: 'confirmation',
        })
        .where(eq(worker.id, workerId));
    },

    async updateProfile(workerId, patch) {
      await db.transaction(async (tx) => {
        const values = profileColumns(patch);
        if (Object.keys(values).length > 0) {
          await tx.update(worker).set(values).where(eq(worker.id, workerId));
        }
        if (patch.skills !== undefined) {
          const codes = patch.skills.map((skill) => skill.tradeCode);
          if (codes.length === 0) {
            await tx.delete(workerSkills).where(eq(workerSkills.workerId, workerId));
          } else {
            await tx
              .insert(workerSkills)
              .values(
                patch.skills.map((skill) => ({
                  workerId,
                  tradeCode: skill.tradeCode,
                  level: skill.level,
                })),
              )
              .onConflictDoUpdate({
                target: [workerSkills.workerId, workerSkills.tradeCode],
                set: { level: sql`excluded.level` },
              });
            await tx
              .delete(workerSkills)
              .where(
                and(eq(workerSkills.workerId, workerId), notInArray(workerSkills.tradeCode, codes)),
              );
          }
        }
        if (patch.serviceAreas !== undefined) {
          await tx.delete(workerServiceAreas).where(eq(workerServiceAreas.workerId, workerId));
          if (patch.serviceAreas.length > 0) {
            await tx.insert(workerServiceAreas).values(
              patch.serviceAreas.map((area) => ({
                workerId,
                position: area.position,
                pincode: area.pincode,
                location: area.location,
                needsFollowup: area.needsFollowup,
              })),
            );
          }
        }
      });
    },
  };
}
