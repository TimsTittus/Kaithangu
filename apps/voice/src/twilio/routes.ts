/**
 * Twilio webhook routes (Phase 7 spec). Every route validates
 * X-Twilio-Signature before touching state; call_sessions is the source of
 * truth for in-progress dialog state, keyed by CallSid (at /incoming) or by
 * the row id (path param on /turn and /outbound).
 *
 * Known gaps (documented, not silently faked):
 * - /incoming always resolves to customer_booking — routing a known worker's
 *   phone to worker_job needs a worker-by-phone lookup that doesn't exist yet.
 * - lookupPincode's "office name" is the pincode itself — PlaceRepo has no
 *   office-name query yet.
 * - VoiceAction execution just logs (see ./actions.ts) — wiring to the real
 *   booking/worker services needs an authenticated RequestContext.
 * - /outbound expects the row (and its `ctx` — activeJob/offer/workerId) to
 *   already exist, created by whatever places the call (not wired up yet).
 */
import formbody from '@fastify/formbody';
import type { FastifyInstance } from 'fastify';
import {
  customerBookingFlow,
  statusUpdateFlow,
  workerAvailabilityFlow,
  workerJobFlow,
  workerOfferFlow,
  type ActiveJob,
  type Flow,
  type FlowContext,
  type JobOffer,
  type VoiceEvent,
  type VoiceTurn,
} from '@kaithangu/core';
import type { CallPurpose, CallSessionRow } from '@kaithangu/db';
import { formatMessage, hasMessage, isSupportedLocale, type Locale } from '@kaithangu/i18n';
import type { VoiceDeps } from '../deps';
import type { VoiceEnv } from '../env';
import { executeVoiceActions } from './actions';
import { nextMeta, replayIfDuplicate, requestFingerprint, type TurnIdempotencyMeta } from './idempotency';
import { isValidTwilioSignature } from './signature';
import { buildTwiml } from './twiml';

const FLOWS: Record<string, Flow<unknown>> = {
  customer_booking: customerBookingFlow,
  status_update: statusUpdateFlow,
  worker_offer: workerOfferFlow,
  worker_availability: workerAvailabilityFlow,
  worker_job: workerJobFlow,
};

interface StoredCtx {
  activeJob?: ActiveJob;
  offer?: JobOffer;
  workerId?: string;
  knownLocale?: Locale;
}

interface StoredState {
  flow: unknown;
  ctx?: StoredCtx;
  meta?: TurnIdempotencyMeta;
  /**
   * True once a `recordConsent` action has fired this call. Twilio's own
   * recording-retention settings are a separate, account-level concern; this
   * flag is what call_recording consent means for *our* fetch/delete cycle:
   * recordings are deleted right after transcription unless the caller has
   * already agreed to the recording disclosure earlier in this same call.
   */
  consentGiven?: boolean;
}

function twilioBody(request: { body: unknown }): Record<string, string> {
  const body = request.body as Record<string, unknown> | null;
  const out: Record<string, string> = {};
  if (body) {
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') out[key] = value;
    }
  }
  return out;
}

function requestUrl(publicUrl: string, path: string): string {
  return new URL(path, publicUrl).toString();
}

function checkSignature(
  request: { headers: Record<string, string | string[] | undefined>; url: string; body: unknown },
  env: VoiceEnv,
): boolean {
  if (!env.TWILIO_AUTH_TOKEN) return true; // dev/mock mode: no token configured, skip verification
  const signature = request.headers['x-twilio-signature'];
  const params = twilioBody(request);
  const url = requestUrl(env.VOICE_PUBLIC_URL, request.url);
  return isValidTwilioSignature(
    env.TWILIO_AUTH_TOKEN,
    url,
    params,
    typeof signature === 'string' ? signature : undefined,
  );
}

function renderText(locale: Locale, key: string, params: Record<string, string | number>): string {
  return hasMessage(locale, key) ? formatMessage(locale, key, params) : key.replace(/[._]/g, ' ');
}

async function audioUrlsFor(turn: VoiceTurn, locale: Locale, env: VoiceEnv, deps: VoiceDeps): Promise<string[]> {
  const urls: string[] = [];
  for (const prompt of turn.prompts) {
    const text = renderText(locale, prompt.key, prompt.params ?? {});
    const hash = await deps.ttsCache.synthesizeAndCache(locale, text);
    urls.push(`${env.VOICE_PUBLIC_URL}/audio/${hash}.wav`);
  }
  return urls;
}

/**
 * Turns the webhook body into a VoiceEvent. Digits come from <Gather>.
 * RecordingUrl comes from <Record> — it always has a value, even for a
 * silent/empty recording, so an empty transcript still needs fetching and
 * transcribing rather than being treated as a timeout. Neither present means
 * <Gather> or <Record> hit their own silence timeout with no input at all.
 */
async function resolveEvent(
  body: Record<string, string>,
  locale: Locale,
  consentGiven: boolean,
  deps: VoiceDeps,
): Promise<VoiceEvent> {
  if (body.Digits) return { type: 'dtmf', digits: body.Digits };

  if (body.RecordingUrl) {
    const { audio, mimeType } = await deps.telephony.fetchRecording(`${body.RecordingUrl}.wav`);
    const { transcript } = await deps.speech.transcribe({ audio, mimeType, locale });
    if (!consentGiven) {
      await deps.telephony.deleteRecording(`${body.RecordingUrl}.json`).catch(() => undefined);
    }
    return { type: 'speech', transcript };
  }

  return { type: 'timeout' };
}

function readStored(row: CallSessionRow): StoredState {
  const state = row.state as Partial<StoredState>;
  return { flow: state.flow, ctx: state.ctx, meta: state.meta, consentGiven: state.consentGiven };
}

function flowForPurpose(purpose: CallPurpose): Flow<unknown> | undefined {
  return FLOWS[purpose];
}

export function registerTwilioRoutes(app: FastifyInstance, env: VoiceEnv, deps: VoiceDeps): void {
  void app.register(formbody);

  async function runActions(
    turn: VoiceTurn,
    row: CallSessionRow,
    locale: Locale,
  ): Promise<string | undefined> {
    const result = await executeVoiceActions(
      turn.actions,
      { phone: row.phone, locale, idempotencyKey: row.callSid },
      deps.actions,
      app.log,
    );
    return result.bookingId;
  }

  async function startCall(
    reply: { type: (t: string) => { send: (b: string) => void } },
    row: CallSessionRow,
    purpose: CallPurpose,
    ctx: FlowContext,
  ): Promise<void> {
    const flow = flowForPurpose(purpose);
    if (!flow) {
      reply.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
      return;
    }
    const locale = ctx.knownLocale ?? 'en';
    const flowState = flow.initial(ctx);
    const { state: nextState, turn } = await flow.step(flowState, { type: 'start' }, deps.flowDeps);

    const actionUrl = requestUrl(env.VOICE_PUBLIC_URL, `/twilio/voice/turn/${row.id}`);
    const audioUrls = await audioUrlsFor(turn, locale, env, deps);
    const twiml = buildTwiml(turn, audioUrls, actionUrl);
    reply.type('text/xml').send(twiml);
    const bookingId = await runActions(turn, row, locale);

    const stored: StoredState = {
      flow: nextState,
      ctx: {
        activeJob: ctx.activeJob,
        offer: ctx.offer,
        workerId: ctx.workerId,
        knownLocale: locale,
      },
      meta: { turnIndex: 0, lastFingerprint: '', lastTwiml: twiml },
    };
    await deps.callSessions.save(row.id, {
      state: stored as unknown as Record<string, unknown>,
      appendTranscript: { direction: 'in', event: { type: 'start' }, prompts: turn.prompts },
      bookingId,
    });
  }

  app.post('/twilio/voice/incoming', async (request, reply) => {
    if (!checkSignature(request, env)) return reply.status(403).send();

    const body = twilioBody(request);
    const callSid = body.CallSid;
    if (!callSid) return reply.status(400).send();
    const from = body.From ?? 'unknown';

    // No worker-by-phone lookup yet — every inbound call runs customer_booking.
    const purpose: CallPurpose = 'customer_booking';
    const row = await deps.callSessions.getOrCreate({ callSid, direction: 'inbound', purpose, phone: from });

    await startCall(reply, row, purpose, { callerPhone: from });
  });

  app.post('/twilio/voice/outbound/:sessionId', async (request, reply) => {
    if (!checkSignature(request, env)) return reply.status(403).send();

    const { sessionId } = request.params as { sessionId: string };
    const row = await deps.callSessions.getById(sessionId);
    if (!row) return reply.status(404).send();

    const stored = readStored(row);
    const ctx: FlowContext = {
      callerPhone: row.phone,
      knownLocale: stored.ctx?.knownLocale ?? (isSupportedLocale(row.locale ?? '') ? (row.locale as Locale) : undefined),
      activeJob: stored.ctx?.activeJob,
      offer: stored.ctx?.offer,
      workerId: stored.ctx?.workerId,
    };
    await startCall(reply, row, row.purpose, ctx);
  });

  app.post('/twilio/voice/turn/:sessionId', async (request, reply) => {
    if (!checkSignature(request, env)) return reply.status(403).send();

    const { sessionId } = request.params as { sessionId: string };
    const row = await deps.callSessions.getById(sessionId);
    if (!row) return reply.status(404).send();

    const body = twilioBody(request);
    const fingerprint = requestFingerprint(body);
    const stored = readStored(row);

    const cachedTwiml = replayIfDuplicate(stored.meta, fingerprint);
    if (cachedTwiml !== null) {
      return reply.type('text/xml').send(cachedTwiml);
    }

    const flow = flowForPurpose(row.purpose);
    if (!flow) {
      return reply.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
    }

    const locale: Locale = stored.ctx?.knownLocale ?? 'en';
    const event = await resolveEvent(body, locale, stored.consentGiven ?? false, deps);
    const { state: nextState, turn } = await flow.step(stored.flow, event, deps.flowDeps);

    const actionUrl = requestUrl(env.VOICE_PUBLIC_URL, `/twilio/voice/turn/${row.id}`);
    const audioUrls = await audioUrlsFor(turn, locale, env, deps);
    const twiml = buildTwiml(turn, audioUrls, actionUrl);
    reply.type('text/xml').send(twiml);

    const bookingId = await runActions(turn, row, locale);
    const consentGiven = (stored.consentGiven ?? false) || turn.actions.some((a) => a.type === 'recordConsent');
    const nextStored: StoredState = {
      flow: nextState,
      ctx: stored.ctx,
      meta: nextMeta(stored.meta, fingerprint, twiml),
      consentGiven,
    };
    await deps.callSessions.save(row.id, {
      state: nextStored as unknown as Record<string, unknown>,
      appendTranscript: { direction: 'in', event, prompts: turn.prompts },
      bookingId,
    });
    if (turn.end) await deps.callSessions.markEnded(row.id);
  });

  app.post('/twilio/voice/status', async (request, reply) => {
    if (!checkSignature(request, env)) return reply.status(403).send();
    app.log.info({ body: twilioBody(request) }, 'twilio call status callback');
    return reply.status(204).send();
  });

  app.get('/audio/:file', async (request, reply) => {
    const { file } = request.params as { file: string };
    const hash = file.endsWith('.wav') ? file.slice(0, -'.wav'.length) : file;
    const audio = deps.ttsCache.read(hash);
    if (!audio) return reply.status(404).send();
    return reply.type('audio/mpeg').send(Buffer.from(audio));
  });
}
