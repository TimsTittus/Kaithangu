/**
 * call_sessions repo for the Twilio transport (Phase 7). `state` stores the
 * flow's own VoiceState plus a small `__meta` envelope so idempotency and
 * turn TwiML replay can be handled without a schema change — see
 * apps/voice/src/twilio/idempotency.ts.
 */
import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import { callSessions } from '../schema';

export type CallDirection = (typeof callSessions.$inferSelect)['direction'];
export type CallPurpose = (typeof callSessions.$inferSelect)['purpose'];

export interface CallSessionRow {
  id: string;
  callSid: string;
  direction: CallDirection;
  purpose: CallPurpose;
  phone: string;
  locale: string | null;
  state: Record<string, unknown>;
  transcript: Record<string, unknown>[];
  outcome: string | null;
  bookingId: string | null;
}

export interface CreateCallSessionInput {
  callSid: string;
  direction: CallDirection;
  purpose: CallPurpose;
  phone: string;
  locale?: string;
}

export interface CallSessionRepo {
  /** Idempotent: a retried webhook for an existing CallSid loads the same row instead of erroring. */
  getOrCreate(input: CreateCallSessionInput): Promise<CallSessionRow>;
  getById(id: string): Promise<CallSessionRow | null>;
  save(
    id: string,
    input: {
      state: Record<string, unknown>;
      appendTranscript?: Record<string, unknown>;
      outcome?: string;
      bookingId?: string;
    },
  ): Promise<void>;
  markEnded(id: string): Promise<void>;
}

function toRow(row: typeof callSessions.$inferSelect): CallSessionRow {
  return {
    id: row.id,
    callSid: row.callSid,
    direction: row.direction,
    purpose: row.purpose,
    phone: row.phone,
    locale: row.locale,
    state: row.state,
    transcript: row.transcript,
    outcome: row.outcome,
    bookingId: row.bookingId,
  };
}

export function createCallSessionRepo(db: Database): CallSessionRepo {
  return {
    async getOrCreate({ callSid, direction, purpose, phone, locale }) {
      const existing = await db
        .select()
        .from(callSessions)
        .where(eq(callSessions.callSid, callSid))
        .limit(1);
      if (existing[0]) return toRow(existing[0]);

      const inserted = await db
        .insert(callSessions)
        .values({ callSid, direction, purpose, phone, locale })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) return toRow(inserted[0]);

      // Lost the insert race to a concurrent duplicate webhook delivery.
      const [row] = await db.select().from(callSessions).where(eq(callSessions.callSid, callSid)).limit(1);
      if (!row) throw new Error(`call_sessions: getOrCreate race for ${callSid} found no row`);
      return toRow(row);
    },

    async getById(id) {
      const [row] = await db.select().from(callSessions).where(eq(callSessions.id, id)).limit(1);
      return row ? toRow(row) : null;
    },

    async save(id, { state, appendTranscript, outcome, bookingId }) {
      if (appendTranscript) {
        const [current] = await db
          .select({ transcript: callSessions.transcript })
          .from(callSessions)
          .where(eq(callSessions.id, id))
          .limit(1);
        const transcript = [...(current?.transcript ?? []), appendTranscript];
        await db.update(callSessions).set({ state, transcript, outcome, bookingId }).where(eq(callSessions.id, id));
      } else {
        await db.update(callSessions).set({ state, outcome, bookingId }).where(eq(callSessions.id, id));
      }
    },

    async markEnded(id) {
      await db.update(callSessions).set({ endedAt: new Date() }).where(eq(callSessions.id, id));
    },
  };
}
