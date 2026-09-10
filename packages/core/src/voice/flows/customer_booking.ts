/**
 * Flow A (Phase 7 spec, customer_booking): language → consent → problem
 * description (LLM extraction) → clarify/trade menu fallback → urgency →
 * pincode (keypad) → landmark → time → quote confirm → createBooking.
 *
 * Each step is a pure function of (state, event, deps) → (state, turn); the
 * transport executes turn.actions and, for createBooking, is expected to
 * feed a synthetic 'speech'/'dtmf'-free confirmation back only if it wants
 * one — this flow ends the call itself once createBooking is emitted.
 */
import { SUPPORTED_LOCALES, type Locale } from '@kaithangu/i18n';
import { TRADE_CODES, type TradeCode } from '../../trades';
import type { Urgency } from '../../pricing';
import type { Flow, FlowContext, FlowDeps, VoicePrompt, VoiceTurn } from '../types';

const LOCALE_BY_DIGIT: Record<string, Locale> = { '1': 'ml', '2': 'en', '3': 'hi', '4': 'ta' };
const DIGIT_BY_LOCALE: Record<Locale, string> = { ml: '1', en: '2', hi: '3', ta: '4' };

const TRADE_MENU_PAGE_SIZE = 5;
const PINCODE_DIGITS = 6;
const CLARIFY_CONFIDENCE_MIN = 0.6;

export interface CustomerBookingData {
  locale: Locale;
  consented: boolean;
  problemSummaryEn?: string;
  tradeCode?: TradeCode;
  urgency?: Urgency;
  pincode?: string;
  pincodeOfficeName?: string;
  stateCode?: string;
  landmarkText?: string;
  timePreference?: 'now' | 'today' | 'tomorrow';
}

type Step =
  | { name: 'language' }
  | { name: 'consent' }
  | { name: 'problem' }
  | { name: 'clarify' }
  | { name: 'trade_menu'; page: number }
  | { name: 'urgency' }
  | { name: 'pincode' }
  | { name: 'pincode_confirm' }
  | { name: 'landmark' }
  | { name: 'time' }
  | { name: 'quote'; quoteTotalPaise: number; billableMinutes: number }
  | { name: 'done' }
  | { name: 'cancelled' };

export interface CustomerBookingState {
  step: Step;
  data: CustomerBookingData;
}

const noExpect = (prompts: VoiceTurn['prompts'], end = false): VoiceTurn => ({
  prompts,
  expect: null,
  actions: [],
  end,
});

const tradePage = (page: number): TradeCode[] =>
  TRADE_CODES.slice(page * TRADE_MENU_PAGE_SIZE, page * TRADE_MENU_PAGE_SIZE + TRADE_MENU_PAGE_SIZE);

function tradeMenuTurn(page: number): VoiceTurn {
  const items = tradePage(page);
  const hasMore = (page + 1) * TRADE_MENU_PAGE_SIZE < TRADE_CODES.length;
  const prompts: VoicePrompt[] = items.map((code, i) => ({
    key: 'voice.trade_menu.option',
    params: { digit: i + 1, trade: code },
  }));
  if (hasMore) prompts.push({ key: 'voice.trade_menu.more', params: { digit: 9 } });
  return {
    prompts,
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 },
    actions: [],
    end: false,
  };
}

function languageMenuTurn(): VoiceTurn {
  const prompts: VoicePrompt[] = SUPPORTED_LOCALES.filter((l) => l !== 'en').map((l) => ({
    key: `voice.language_menu.${l}`,
    params: { digit: DIGIT_BY_LOCALE[l] },
  }));
  prompts.push({ key: 'voice.language_menu.en', params: { digit: DIGIT_BY_LOCALE.en } });
  return {
    prompts,
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 },
    actions: [],
    end: false,
  };
}

function consentTurn(): VoiceTurn {
  return {
    prompts: [{ key: 'voice.consent.intro' }],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 },
    actions: [],
    end: false,
  };
}

function problemTurn(): VoiceTurn {
  return {
    prompts: [{ key: 'voice.problem.ask' }],
    expect: { mode: 'speech', maxSeconds: 15 },
    actions: [],
    end: false,
  };
}

function clarifyTurn(): VoiceTurn {
  return {
    prompts: [{ key: 'voice.problem.clarify' }],
    expect: { mode: 'speech', maxSeconds: 15 },
    actions: [],
    end: false,
  };
}

function urgencyTurn(): VoiceTurn {
  return {
    prompts: [{ key: 'voice.urgency.ask' }],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 },
    actions: [],
    end: false,
  };
}

function pincodeTurn(): VoiceTurn {
  return {
    prompts: [{ key: 'voice.pincode.ask' }],
    expect: { mode: 'dtmf', dtmfDigits: PINCODE_DIGITS, maxSeconds: 20 },
    actions: [],
    end: false,
  };
}

function pincodeConfirmTurn(officeName: string): VoiceTurn {
  return {
    prompts: [{ key: 'voice.pincode.confirm', params: { officeName } }],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 },
    actions: [],
    end: false,
  };
}

function landmarkTurn(): VoiceTurn {
  return {
    prompts: [{ key: 'voice.landmark.ask' }],
    expect: { mode: 'speech', maxSeconds: 15 },
    actions: [],
    end: false,
  };
}

function timeTurn(): VoiceTurn {
  return {
    prompts: [{ key: 'voice.time.ask' }],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 },
    actions: [],
    end: false,
  };
}

function quoteTurn(totalPaise: number): VoiceTurn {
  return {
    prompts: [{ key: 'voice.quote.total', params: { totalPaise } }],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 },
    actions: [],
    end: false,
  };
}

export const customerBookingFlow: Flow<CustomerBookingState> = {
  id: 'customer_booking',

  initial(ctx: FlowContext): CustomerBookingState {
    const locale = ctx.knownLocale ?? 'en';
    return {
      step: ctx.knownLocale ? { name: 'consent' } : { name: 'language' },
      data: { locale, consented: false },
    };
  },

  async step(state, event, deps) {
    const { step, data } = state;

    switch (step.name) {
      case 'language': {
        if (event.type !== 'dtmf') return { state, turn: languageMenuTurn() };
        const locale = LOCALE_BY_DIGIT[event.digits];
        if (!locale) return { state, turn: languageMenuTurn() };
        return {
          state: { step: { name: 'consent' }, data: { ...data, locale } },
          turn: consentTurn(),
        };
      }

      case 'consent': {
        if (event.type !== 'dtmf' || event.digits !== '1') {
          return { state, turn: consentTurn() };
        }
        return {
          state: { step: { name: 'problem' }, data: { ...data, consented: true } },
          turn: {
            ...problemTurn(),
            actions: [{ type: 'recordConsent', purpose: 'voice_booking_recording' }],
          },
        };
      }

      case 'problem': {
        if (event.type !== 'speech') return { state, turn: problemTurn() };
        const extracted = await deps.extract({ transcript: event.transcript, locale: data.locale });
        return afterExtraction(data, extracted);
      }

      case 'clarify': {
        if (event.type !== 'speech') return { state, turn: clarifyTurn() };
        const extracted = await deps.extract({ transcript: event.transcript, locale: data.locale });
        if (extracted.tradeCode === null || extracted.confidence < CLARIFY_CONFIDENCE_MIN) {
          const merged = { ...data, urgency: mergedUrgency(data.urgency, extracted) };
          return { state: { step: { name: 'trade_menu', page: 0 }, data: merged }, turn: tradeMenuTurn(0) };
        }
        return afterExtraction(data, extracted);
      }

      case 'trade_menu': {
        if (event.type !== 'dtmf') return { state, turn: tradeMenuTurn(step.page) };
        if (event.digits === '9') {
          const hasMore = (step.page + 1) * TRADE_MENU_PAGE_SIZE < TRADE_CODES.length;
          const nextPage = hasMore ? step.page + 1 : 0;
          return { state: { step: { name: 'trade_menu', page: nextPage }, data }, turn: tradeMenuTurn(nextPage) };
        }
        const index = Number.parseInt(event.digits, 10) - 1;
        const items = tradePage(step.page);
        const tradeCode = items[index];
        if (tradeCode === undefined) return { state, turn: tradeMenuTurn(step.page) };
        return afterTrade({ ...data, tradeCode });
      }

      case 'urgency': {
        if (event.type !== 'dtmf' || (event.digits !== '1' && event.digits !== '2')) {
          return { state, turn: urgencyTurn() };
        }
        const urgency: Urgency = event.digits === '1' ? 'emergency' : 'normal';
        return { state: { step: { name: 'pincode' }, data: { ...data, urgency } }, turn: pincodeTurn() };
      }

      case 'pincode': {
        if (event.type !== 'dtmf' || event.digits.length !== PINCODE_DIGITS) {
          return { state, turn: pincodeTurn() };
        }
        const info = await deps.places.lookupPincode(event.digits);
        if (!info) return { state, turn: pincodeTurn() };
        return {
          state: {
            step: { name: 'pincode_confirm' },
            data: { ...data, pincode: event.digits, pincodeOfficeName: info.officeName, stateCode: info.stateCode },
          },
          turn: pincodeConfirmTurn(info.officeName),
        };
      }

      case 'pincode_confirm': {
        if (event.type !== 'dtmf' || (event.digits !== '1' && event.digits !== '2')) {
          return { state, turn: pincodeConfirmTurn(data.pincodeOfficeName ?? '') };
        }
        if (event.digits === '2') {
          return { state: { step: { name: 'pincode' }, data }, turn: pincodeTurn() };
        }
        return { state: { step: { name: 'landmark' }, data }, turn: landmarkTurn() };
      }

      case 'landmark': {
        if (event.type !== 'speech') return { state, turn: landmarkTurn() };
        const next = { ...data, landmarkText: event.transcript };
        if (next.timePreference) return afterTime(next, deps);
        return { state: { step: { name: 'time' }, data: next }, turn: timeTurn() };
      }

      case 'time': {
        if (event.type !== 'dtmf' || !['1', '2', '3'].includes(event.digits)) {
          return { state, turn: timeTurn() };
        }
        const timePreference = event.digits === '1' ? 'now' : event.digits === '2' ? 'today' : 'tomorrow';
        return afterTime({ ...data, timePreference }, deps);
      }

      case 'quote': {
        if (event.type !== 'dtmf' || !['1', '2', '3'].includes(event.digits)) {
          return { state, turn: quoteTurn(step.quoteTotalPaise) };
        }
        if (event.digits === '2') return { state, turn: quoteTurn(step.quoteTotalPaise) };
        if (event.digits === '3') {
          return { state: { step: { name: 'cancelled' }, data }, turn: noExpect([{ key: 'voice.cancelled' }], true) };
        }
        return {
          state: { step: { name: 'done' }, data },
          turn: {
            prompts: [{ key: 'voice.booking.confirmed' }],
            expect: null,
            end: true,
            actions: [
              {
                type: 'createBooking',
                payload: {
                  tradeCode: data.tradeCode,
                  urgency: data.urgency ?? 'normal',
                  pincode: data.pincode,
                  problemText: data.problemSummaryEn,
                  addressText: data.landmarkText,
                  timePreference: data.timePreference,
                },
              },
            ],
          },
        };
      }

      case 'done':
      case 'cancelled':
        return { state, turn: noExpect([], true) };

      default: {
        const exhaustive: never = step;
        throw new Error(`unhandled step ${JSON.stringify(exhaustive)}`);
      }
    }
  },
};

function mergedUrgency(
  current: Urgency | undefined,
  extracted: { urgency: 'normal' | 'emergency' | null; safetyRisk: boolean },
): Urgency | undefined {
  if (extracted.safetyRisk) return 'emergency';
  return extracted.urgency ?? current;
}

function afterExtraction(
  data: CustomerBookingData,
  extracted: Awaited<ReturnType<FlowDeps['extract']>>,
): { state: CustomerBookingState; turn: VoiceTurn } {
  const merged: CustomerBookingData = {
    ...data,
    problemSummaryEn: extracted.problemSummaryEn,
    urgency: mergedUrgency(data.urgency, extracted),
    timePreference: extracted.timePreference ?? data.timePreference,
  };

  if (extracted.safetyRisk) {
    return {
      state: { step: { name: 'clarify' }, data: merged },
      turn: { ...clarifyTurn(), prompts: [{ key: 'voice.safety.warning' }, ...clarifyTurn().prompts] },
    };
  }

  if (extracted.tradeCode !== null && extracted.confidence >= CLARIFY_CONFIDENCE_MIN) {
    return afterTrade({ ...merged, tradeCode: extracted.tradeCode });
  }

  return { state: { step: { name: 'clarify' }, data: merged }, turn: clarifyTurn() };
}

function afterTrade(data: CustomerBookingData): { state: CustomerBookingState; turn: VoiceTurn } {
  if (!data.urgency) {
    return { state: { step: { name: 'urgency' }, data }, turn: urgencyTurn() };
  }
  return { state: { step: { name: 'pincode' }, data }, turn: pincodeTurn() };
}

async function afterTime(
  data: CustomerBookingData,
  deps: FlowDeps,
): Promise<{ state: CustomerBookingState; turn: VoiceTurn }> {
  if (!data.tradeCode || !data.stateCode) {
    throw new Error('afterTime requires tradeCode and stateCode');
  }
  const estimatedMinutes = 60;
  const q = await deps.pricing.quote({
    stateCode: data.stateCode,
    tradeCode: data.tradeCode,
    estimatedMinutes,
    urgency: data.urgency ?? 'normal',
  });
  if (!q) {
    return { state: { step: { name: 'cancelled' }, data }, turn: noExpect([{ key: 'voice.error.no_rates' }], true) };
  }
  return {
    state: { step: { name: 'quote', quoteTotalPaise: q.total, billableMinutes: q.billableMinutes }, data },
    turn: quoteTurn(q.total),
  };
}
