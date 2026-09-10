import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CallSessionRepo, CallSessionRow, CreateCallSessionInput } from '@kaithangu/db';
import type { FlowDeps } from '@kaithangu/core';
import type { ActionExecutorDeps } from './actions';
import { buildServer } from '../server';
import type { VoiceDeps } from '../deps';
import type { VoiceEnv } from '../env';
import { createTtsCache } from './tts';
import { computeTwilioSignature } from './signature';

function fakeCallSessionRepo(): CallSessionRepo & { rows: Map<string, CallSessionRow> } {
  const rows = new Map<string, CallSessionRow>();
  const byCallSid = new Map<string, string>();
  let nextId = 1;
  return {
    rows,
    getOrCreate(input: CreateCallSessionInput) {
      const existingId = byCallSid.get(input.callSid);
      if (existingId) return Promise.resolve(rows.get(existingId)!);
      const id = `row-${nextId++}`;
      const row: CallSessionRow = {
        id,
        callSid: input.callSid,
        direction: input.direction,
        purpose: input.purpose,
        phone: input.phone,
        locale: input.locale ?? null,
        state: {},
        transcript: [],
        outcome: null,
        bookingId: null,
      };
      rows.set(id, row);
      byCallSid.set(input.callSid, id);
      return Promise.resolve(row);
    },
    getById(id: string) {
      return Promise.resolve(rows.get(id) ?? null);
    },
    save(id, { state, appendTranscript, outcome, bookingId }) {
      const row = rows.get(id);
      if (!row) throw new Error(`no row ${id}`);
      row.state = state;
      if (appendTranscript) row.transcript = [...row.transcript, appendTranscript];
      if (outcome !== undefined) row.outcome = outcome;
      if (bookingId !== undefined) row.bookingId = bookingId;
      return Promise.resolve();
    },
    markEnded() {
      return Promise.resolve();
    },
  };
}

function fakeFlowDeps(): FlowDeps {
  return {
    extract: () =>
      Promise.resolve({
        tradeCode: null,
        confidence: 0,
        urgency: null,
        timePreference: null,
        problemSummaryEn: '',
        safetyRisk: false,
        outOfScope: false,
      }),
    places: { lookupPincode: () => Promise.resolve(null) },
    pricing: { quote: () => Promise.resolve(null) },
    codes: { verifyJobOtp: () => false, deriveJobOtp: () => '0000' },
    earnings: { today: () => Promise.resolve({ totalPaise: 0, jobCount: 0 }) },
    clock: { now: () => new Date('2026-01-01T00:00:00Z') },
  };
}

function fakeActionExecutorDeps(): ActionExecutorDeps {
  return {
    users: {
      upsertOnLogin: ({ phone }) =>
        Promise.resolve({
          user: {
            id: 'user-1',
            phone,
            name: null,
            role: 'customer',
            locale: 'en',
            sessionVersion: 1,
            stateCode: 'KL',
            societyId: null,
            societyStateCode: null,
            institutionId: null,
            institutionStateCode: null,
          },
          created: false,
        }),
      findSessionUser: () => Promise.resolve(null),
      bumpSessionVersion: () => Promise.resolve(null),
      setLocale: () => Promise.resolve(),
    },
    bookings: {
      quote: () => Promise.reject(new Error('unused')),
      bookingOptions: () => Promise.reject(new Error('unused')),
      createBooking: () => Promise.resolve({ id: 'booking-1', status: 'requested', replayed: false }),
      getBooking: () => Promise.reject(new Error('unused')),
      listBookings: () => Promise.reject(new Error('unused')),
      cancelBooking: () => Promise.reject(new Error('unused')),
    } as unknown as ActionExecutorDeps['bookings'],
    consent: {
      hasAcceptedTerms: () => Promise.resolve(true),
      acceptTerms: () => Promise.resolve(),
      assertConsented: () => Promise.resolve(),
    },
    defaultStateCode: 'KL',
  };
}

const ENV: VoiceEnv = {
  NODE_ENV: 'test',
  VOICE_PORT: 4000,
  VOICE_HOST: '127.0.0.1',
  VOICE_PUBLIC_URL: 'https://voice.example.com',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/none',
  STORAGE_DIR: '',
  OTP_PEPPER: 'test-otp-pepper-at-least-32-characters-long',
  DEFAULT_STATE: 'KL',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
};

describe('twilio voice routes', () => {
  let storageDir: string;
  let deps: VoiceDeps;
  let repo: ReturnType<typeof fakeCallSessionRepo>;
  let app: ReturnType<typeof buildServer>;
  let env: VoiceEnv;

  let deletedRecordings: string[];
  let fetchedRecordings: string[];

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), 'voice-sim-'));
    repo = fakeCallSessionRepo();
    env = { ...ENV, STORAGE_DIR: storageDir };
    deletedRecordings = [];
    fetchedRecordings = [];
    deps = {
      db: {} as VoiceDeps['db'],
      telephony: {
        placeCall: () => Promise.reject(new Error('unused')),
        fetchRecording: (url: string) => {
          fetchedRecordings.push(url);
          return Promise.resolve({ audio: new Uint8Array([9, 9, 9]), mimeType: 'audio/x-wav' });
        },
        deleteRecording: (url: string) => {
          deletedRecordings.push(url);
          return Promise.resolve();
        },
      },
      speech: {
        synthesize: () => Promise.resolve(new Uint8Array([1, 2, 3])),
        transcribe: () => Promise.resolve({ transcript: 'my tap is leaking' }),
        translate: () => Promise.reject(new Error('unused')),
      },
      llm: { complete: () => Promise.resolve('{}') },
      ttsCache: createTtsCache({ synthesize: () => Promise.resolve(new Uint8Array([1, 2, 3])) }, storageDir),
      callSessions: repo,
      flowDeps: fakeFlowDeps(),
      actions: fakeActionExecutorDeps(),
    };
    app = buildServer({ logger: false, version: '1.0.0', voice: { env, deps } });
  });

  afterEach(async () => {
    await app.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  function signedRequest(path: string, params: Record<string, string>) {
    const url = new URL(path, env.VOICE_PUBLIC_URL).toString();
    const signature = computeTwilioSignature(env.TWILIO_AUTH_TOKEN!, url, params);
    return { path, params, signature };
  }

  it('rejects an invalid signature with 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/twilio/voice/incoming',
      headers: { 'x-twilio-signature': 'bogus', 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'CallSid=CA1&From=%2B919999999999',
    });
    expect(response.statusCode).toBe(403);
  });

  it('accepts a valid signature and starts the flow with TwiML', async () => {
    const { path, params, signature } = signedRequest('/twilio/voice/incoming', {
      CallSid: 'CA1',
      From: '+919999999999',
    });
    const response = await app.inject({
      method: 'POST',
      url: path,
      headers: { 'x-twilio-signature': signature, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(params).toString(),
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/xml');
    expect(response.body).toContain('<Gather');
    expect(repo.rows.size).toBe(1);
  });

  it('serves cached TTS audio at /audio/:hash.wav', async () => {
    const hash = await deps.ttsCache.synthesizeAndCache('en', 'hello');
    const response = await app.inject({ method: 'GET', url: `/audio/${hash}.wav` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('audio/mpeg');
  });

  it('404s for an unknown audio hash', async () => {
    const response = await app.inject({ method: 'GET', url: '/audio/does-not-exist.wav' });
    expect(response.statusCode).toBe(404);
  });

  it('replays the same TwiML for a retried (idempotent) turn webhook', async () => {
    const start = signedRequest('/twilio/voice/incoming', { CallSid: 'CA2', From: '+919999999999' });
    await app.inject({
      method: 'POST',
      url: start.path,
      headers: { 'x-twilio-signature': start.signature, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(start.params).toString(),
    });
    const sessionId = [...repo.rows.values()][0]!.id;

    const turn = signedRequest(`/twilio/voice/turn/${sessionId}`, { Digits: '1' });
    const first = await app.inject({
      method: 'POST',
      url: turn.path,
      headers: { 'x-twilio-signature': turn.signature, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(turn.params).toString(),
    });
    const second = await app.inject({
      method: 'POST',
      url: turn.path,
      headers: { 'x-twilio-signature': turn.signature, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(turn.params).toString(),
    });
    expect(first.body).toBe(second.body);
  });

  it('fetches and transcribes a RecordingUrl, then deletes it (no consent given yet)', async () => {
    const start = signedRequest('/twilio/voice/incoming', { CallSid: 'CA3', From: '+919999999999' });
    await app.inject({
      method: 'POST',
      url: start.path,
      headers: { 'x-twilio-signature': start.signature, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(start.params).toString(),
    });
    const sessionId = [...repo.rows.values()][0]!.id;

    const turn = signedRequest(`/twilio/voice/turn/${sessionId}`, {
      RecordingUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1',
    });
    await app.inject({
      method: 'POST',
      url: turn.path,
      headers: { 'x-twilio-signature': turn.signature, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(turn.params).toString(),
    });

    expect(fetchedRecordings).toEqual(['https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1.wav']);
    expect(deletedRecordings).toEqual(['https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1.json']);
    const row = repo.rows.get(sessionId)!;
    const lastTurn = row.transcript.at(-1) as { event: { transcript: string } };
    expect(lastTurn.event.transcript).toBe('my tap is leaking');
  });
});
