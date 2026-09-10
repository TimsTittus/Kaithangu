import { describe, expect, it } from 'vitest';
import { paise } from '../../money';
import type { ActiveJob, ExtractResult, FlowDeps, JobOffer } from '../types';
import { statusUpdateFlow } from './status_update';
import { workerAvailabilityFlow } from './worker_availability';
import { workerJobFlow } from './worker_job';
import { workerOfferFlow } from './worker_offer';

const NOT_UNDERSTOOD: ExtractResult = {
  tradeCode: null,
  confidence: 0,
  urgency: null,
  timePreference: null,
  problemSummaryEn: '',
  safetyRisk: false,
  outOfScope: false,
};

function makeDeps(overrides: Partial<FlowDeps> = {}): FlowDeps {
  const defaults: FlowDeps = {
    extract: () => Promise.resolve(NOT_UNDERSTOOD),
    places: { lookupPincode: () => Promise.resolve(null) },
    pricing: { quote: () => Promise.resolve(null) },
    codes: {
      verifyJobOtp: (_bookingId, _kind, otp) => otp === '1234',
      deriveJobOtp: () => '1234',
    },
    earnings: { today: () => Promise.resolve({ totalPaise: 50_00, jobCount: 2 }) },
    clock: { now: () => new Date('2026-01-01T00:00:00Z') },
  };
  return { ...defaults, ...overrides };
}

const JOB: ActiveJob = {
  bookingId: 'booking-1',
  workerId: 'worker-1',
  workerName: 'Ravi',
  tradeCode: 'plumber',
  societyName: 'Green Meadows',
  customerName: 'Anita',
  arrivalEstimateMinutes: 20,
};

const OFFER: JobOffer = {
  offerId: '11111111-1111-1111-1111-111111111111',
  tradeCode: 'plumber',
  locality: 'Kowdiar',
  distanceKm: 2.4,
  wagePaise: paise(30_000),
};

describe('status_update flow', () => {
  it('announces the job and reads the OTP, repeats on press 1, ends otherwise', async () => {
    const deps = makeDeps();
    const state = statusUpdateFlow.initial({ callerPhone: '+919999999999', activeJob: JOB });

    const announced = await statusUpdateFlow.step(state, { type: 'start' }, deps);
    expect(announced.turn.end).toBe(false);
    expect(announced.turn.prompts.some((p) => p.key === 'voice.status_update.otp')).toBe(true);

    const repeated = await statusUpdateFlow.step(announced.state, { type: 'dtmf', digits: '1' }, deps);
    expect(repeated.turn.end).toBe(false);

    const ended = await statusUpdateFlow.step(repeated.state, { type: 'timeout' }, deps);
    expect(ended.turn.end).toBe(true);
  });
});

describe('worker_offer flow', () => {
  it('accept emits acceptOffer and ends', async () => {
    const deps = makeDeps();
    const state = workerOfferFlow.initial({ callerPhone: '+919999999999', offer: OFFER });
    const started = await workerOfferFlow.step(state, { type: 'start' }, deps);
    const result = await workerOfferFlow.step(started.state, { type: 'dtmf', digits: '1' }, deps);
    expect(result.turn.end).toBe(true);
    expect(result.turn.actions).toEqual([{ type: 'acceptOffer', offerId: OFFER.offerId }]);
  });

  it('decline emits declineOffer and ends', async () => {
    const deps = makeDeps();
    const state = workerOfferFlow.initial({ callerPhone: '+919999999999', offer: OFFER });
    const started = await workerOfferFlow.step(state, { type: 'start' }, deps);
    const result = await workerOfferFlow.step(started.state, { type: 'dtmf', digits: '2' }, deps);
    expect(result.turn.end).toBe(true);
    expect(result.turn.actions).toEqual([{ type: 'declineOffer', offerId: OFFER.offerId }]);
  });

  it('no input within 20s (timeout) ends with no action', async () => {
    const deps = makeDeps();
    const state = workerOfferFlow.initial({ callerPhone: '+919999999999', offer: OFFER });
    const started = await workerOfferFlow.step(state, { type: 'start' }, deps);
    const result = await workerOfferFlow.step(started.state, { type: 'timeout' }, deps);
    expect(result.turn.end).toBe(true);
    expect(result.turn.actions).toEqual([]);
  });
});

describe('worker_availability flow', () => {
  it('press 1 sets available true', async () => {
    const deps = makeDeps();
    const state = workerAvailabilityFlow.initial({ callerPhone: '+919999999999', workerId: 'worker-1' });
    const started = await workerAvailabilityFlow.step(state, { type: 'start' }, deps);
    const result = await workerAvailabilityFlow.step(started.state, { type: 'dtmf', digits: '1' }, deps);
    expect(result.turn.actions).toEqual([{ type: 'setAvailability', available: true }]);
  });

  it('press 2 sets available false', async () => {
    const deps = makeDeps();
    const state = workerAvailabilityFlow.initial({ callerPhone: '+919999999999', workerId: 'worker-1' });
    const started = await workerAvailabilityFlow.step(state, { type: 'start' }, deps);
    const result = await workerAvailabilityFlow.step(started.state, { type: 'dtmf', digits: '2' }, deps);
    expect(result.turn.actions).toEqual([{ type: 'setAvailability', available: false }]);
  });
});

describe('worker_job flow', () => {
  it('option 2: valid start code emits startJob and ends', async () => {
    const deps = makeDeps();
    const state = workerJobFlow.initial({ callerPhone: '+919999999999', activeJob: JOB });
    const menu = await workerJobFlow.step(state, { type: 'start' }, deps);
    const askCode = await workerJobFlow.step(menu.state, { type: 'dtmf', digits: '2' }, deps);
    expect(askCode.turn.expect).toEqual({ mode: 'dtmf', dtmfDigits: 4, maxSeconds: 20 });
    const result = await workerJobFlow.step(askCode.state, { type: 'dtmf', digits: '1234' }, deps);
    expect(result.turn.end).toBe(true);
    expect(result.turn.actions).toEqual([{ type: 'startJob', otp: '1234' }]);
  });

  it('invalid start OTP re-prompts instead of advancing', async () => {
    const deps = makeDeps();
    const state = workerJobFlow.initial({ callerPhone: '+919999999999', activeJob: JOB });
    const menu = await workerJobFlow.step(state, { type: 'start' }, deps);
    const askCode = await workerJobFlow.step(menu.state, { type: 'dtmf', digits: '2' }, deps);
    const result = await workerJobFlow.step(askCode.state, { type: 'dtmf', digits: '0000' }, deps);
    expect(result.turn.end).toBe(false);
    expect(result.turn.actions).toEqual([]);
    expect(result.turn.prompts[0]).toEqual({ key: 'voice.worker_job.invalid_code' });
  });

  it('option 3: valid complete code emits completeJob and ends', async () => {
    const deps = makeDeps();
    const state = workerJobFlow.initial({ callerPhone: '+919999999999', activeJob: JOB });
    const menu = await workerJobFlow.step(state, { type: 'start' }, deps);
    const askCode = await workerJobFlow.step(menu.state, { type: 'dtmf', digits: '3' }, deps);
    const result = await workerJobFlow.step(askCode.state, { type: 'dtmf', digits: '1234' }, deps);
    expect(result.turn.actions).toEqual([{ type: 'completeJob', otp: '1234' }]);
  });

  it('option 4: reads earnings and returns to the menu', async () => {
    const deps = makeDeps();
    const state = workerJobFlow.initial({ callerPhone: '+919999999999', activeJob: JOB });
    const menu = await workerJobFlow.step(state, { type: 'start' }, deps);
    const result = await workerJobFlow.step(menu.state, { type: 'dtmf', digits: '4' }, deps);
    expect(result.turn.end).toBe(false);
    expect(result.turn.prompts[0]).toEqual({
      key: 'voice.worker_job.earnings',
      params: { totalPaise: 5000, jobCount: 2 },
    });
  });

  it('option 1: on the way acknowledgement returns to the menu', async () => {
    const deps = makeDeps();
    const state = workerJobFlow.initial({ callerPhone: '+919999999999', activeJob: JOB });
    const menu = await workerJobFlow.step(state, { type: 'start' }, deps);
    const result = await workerJobFlow.step(menu.state, { type: 'dtmf', digits: '1' }, deps);
    expect(result.turn.end).toBe(false);
    expect(result.turn.expect).toEqual({ mode: 'dtmf', dtmfDigits: 1, maxSeconds: 10 });
  });
});
