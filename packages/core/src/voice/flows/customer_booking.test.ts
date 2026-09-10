import { describe, expect, it } from 'vitest';
import type { LngLat } from '../../geo';
import { paise } from '../../money';
import type { ExtractResult, FlowDeps, VoiceEvent } from '../types';
import { customerBookingFlow, type CustomerBookingState } from './customer_booking';

const POINT: LngLat = { lng: 76.9, lat: 8.5 };

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
    places: {
      lookupPincode: (pincode) =>
        Promise.resolve(
          pincode === '695001' ? { officeName: 'Thiruvananthapuram HO', stateCode: 'KL', location: POINT } : null,
        ),
    },
    pricing: {
      quote: () =>
        Promise.resolve({
          billableMinutes: 60,
          wage: paise(20_000),
          surcharge: paise(0),
          welfare: paise(1_000),
          platformFee: paise(1_000),
          gst: paise(0),
          total: paise(22_000),
          breakdownKeys: [],
        }),
    },
    codes: { verifyJobOtp: () => false, deriveJobOtp: () => '0000' },
    earnings: { today: () => Promise.resolve({ totalPaise: 0, jobCount: 0 }) },
    clock: { now: () => new Date('2026-01-01T00:00:00Z') },
  };
  return { ...defaults, ...overrides };
}

async function run(
  deps: FlowDeps,
  events: VoiceEvent[],
  initial?: CustomerBookingState,
): Promise<{ state: CustomerBookingState; turns: Awaited<ReturnType<typeof customerBookingFlow.step>>['turn'][] }> {
  let state = initial ?? customerBookingFlow.initial({ callerPhone: '+919999999999' });
  const turns = [];
  for (const event of events) {
    const result = await customerBookingFlow.step(state, event, deps);
    state = result.state;
    turns.push(result.turn);
  }
  return { state, turns };
}

describe('customer_booking flow', () => {
  it('unknown caller: language menu, then consent, problem, extracted trade, pincode, landmark, time, quote confirm', async () => {
    const deps = makeDeps({
      extract: () =>
        Promise.resolve({
          tradeCode: 'plumber',
          confidence: 0.9,
          urgency: 'normal',
          timePreference: 'now',
          problemSummaryEn: 'leaking tap',
          safetyRisk: false,
          outOfScope: false,
        }),
    });

    const { state, turns } = await run(deps, [
      { type: 'dtmf', digits: '2' }, // English
      { type: 'dtmf', digits: '1' }, // consent
      { type: 'speech', transcript: 'my tap is leaking' }, // problem -> extracted trade+urgency+time
      { type: 'dtmf', digits: '695001' }, // pincode
      { type: 'dtmf', digits: '1' }, // confirm pincode
      { type: 'speech', transcript: 'near the temple' }, // landmark
      { type: 'dtmf', digits: '1' }, // confirm quote
    ]);

    expect(state.step.name).toBe('done');
    expect(state.data.tradeCode).toBe('plumber');
    expect(state.data.pincode).toBe('695001');
    const last = turns.at(-1)!;
    expect(last.end).toBe(true);
    expect(last.actions).toEqual([
      {
        type: 'createBooking',
        payload: {
          tradeCode: 'plumber',
          urgency: 'normal',
          pincode: '695001',
          problemText: 'leaking tap',
          addressText: 'near the temple',
          timePreference: 'now',
        },
      },
    ]);
  });

  it('known caller skips the language menu', () => {
    const state = customerBookingFlow.initial({ callerPhone: '+919999999999', knownLocale: 'ml' });
    expect(state.step.name).toBe('consent');
    expect(state.data.locale).toBe('ml');
  });

  it('low-confidence trade falls back to one clarification, then DTMF trade menu', async () => {
    const deps = makeDeps();
    let state: CustomerBookingState = {
      step: { name: 'problem' },
      data: { locale: 'en', consented: true },
    };

    let result = await customerBookingFlow.step(state, { type: 'speech', transcript: 'something broken' }, deps);
    expect(result.state.step.name).toBe('clarify');
    state = result.state;

    result = await customerBookingFlow.step(state, { type: 'speech', transcript: 'still unclear' }, deps);
    expect(result.state.step.name).toBe('trade_menu');
    expect(result.turn.expect).toEqual({ mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 });
  });

  it('safety-risk utterance forces emergency and speaks a safety line before clarifying', async () => {
    const deps = makeDeps({
      extract: () =>
        Promise.resolve({
          tradeCode: null,
          confidence: 0.3,
          urgency: null,
          timePreference: null,
          problemSummaryEn: 'gas smell',
          safetyRisk: true,
          outOfScope: false,
        }),
    });
    const state: CustomerBookingState = { step: { name: 'problem' }, data: { locale: 'en', consented: true } };
    const result = await customerBookingFlow.step(state, { type: 'speech', transcript: 'I smell gas' }, deps);

    expect(result.state.step.name).toBe('clarify');
    expect(result.state.data.urgency).toBe('emergency');
    expect(result.turn.prompts[0]).toEqual({ key: 'voice.safety.warning' });
  });

  it('trade menu: page 1 digit 3 selects the third trade, "9" pages forward', async () => {
    const deps = makeDeps();
    const state: CustomerBookingState = {
      step: { name: 'trade_menu', page: 0 },
      data: { locale: 'en', consented: true },
    };

    const paged = await customerBookingFlow.step(state, { type: 'dtmf', digits: '9' }, deps);
    expect(paged.state.step).toEqual({ name: 'trade_menu', page: 1 });

    const picked = await customerBookingFlow.step(state, { type: 'dtmf', digits: '3' }, deps);
    expect(picked.state.data.tradeCode).toBe('carpenter');
  });

  it('wrong pincode re-prompts instead of advancing', async () => {
    const deps = makeDeps();
    const state: CustomerBookingState = {
      step: { name: 'pincode' },
      data: { locale: 'en', consented: true, tradeCode: 'plumber', urgency: 'normal' },
    };
    const result = await customerBookingFlow.step(state, { type: 'dtmf', digits: '000000' }, deps);
    expect(result.state.step.name).toBe('pincode');
    expect(result.turn.expect?.mode).toBe('dtmf');
  });

  it('cancel at quote ends the call with no createBooking action', async () => {
    const deps = makeDeps();
    const state: CustomerBookingState = {
      step: { name: 'quote', quoteTotalPaise: 22000, billableMinutes: 60 },
      data: { locale: 'en', consented: true, tradeCode: 'plumber', urgency: 'normal' },
    };
    const result = await customerBookingFlow.step(state, { type: 'dtmf', digits: '3' }, deps);
    expect(result.state.step.name).toBe('cancelled');
    expect(result.turn.end).toBe(true);
    expect(result.turn.actions).toEqual([]);
  });

  it('silence (timeout) twice on the language menu keeps re-prompting rather than crashing', async () => {
    const state = customerBookingFlow.initial({ callerPhone: '+919999999999' });
    const deps = makeDeps();
    const first = await customerBookingFlow.step(state, { type: 'timeout' }, deps);
    expect(first.state.step.name).toBe('language');
    const second = await customerBookingFlow.step(first.state, { type: 'timeout' }, deps);
    expect(second.state.step.name).toBe('language');
  });
});
