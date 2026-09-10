/**
 * Offline FlowDeps for the voice simulator (scripts/voice/sim.ts): no
 * network, no real DB — a keyword-matching stand-in for LLM extraction and
 * a couple of fixture pincodes, so `--flow customer_booking` is exercisable
 * without any provider keys configured.
 */
import { deriveJobOtp, paise, quote, type FlowDeps, type TradeCode } from '@kaithangu/core';
import { tradeSynonyms } from '@kaithangu/i18n/tradeSynonyms';

const DEV_SECRET = 'voice-sim-dev-secret-not-for-production-use-only';

const FIXTURE_PINCODES: Readonly<Record<string, { officeName: string; stateCode: string }>> = {
  '695001': { officeName: 'Thiruvananthapuram H.O', stateCode: 'KL' },
  '682001': { officeName: 'Kochi H.O', stateCode: 'KL' },
  '600001': { officeName: 'Chennai G.P.O', stateCode: 'TN' },
};

const SAFETY_WORDS = ['gas', 'spark', 'sparks', 'fire', 'flood', 'flooding', 'smoke'];
const EMERGENCY_WORDS = ['emergency', 'urgent', 'right now', 'immediately'];

/** Naive keyword match against the English trade synonym catalogue. */
function matchTrade(transcript: string): { tradeCode: TradeCode | null; confidence: number } {
  const lower = transcript.toLowerCase();
  for (const [trade, synonyms] of Object.entries(tradeSynonyms.en)) {
    if (synonyms.some((word) => lower.includes(word))) {
      return { tradeCode: trade as TradeCode, confidence: 0.85 };
    }
  }
  return { tradeCode: null, confidence: 0.2 };
}

export function buildSimDeps(): FlowDeps {
  return {
    extract({ transcript }) {
      const lower = transcript.toLowerCase();
      const { tradeCode, confidence } = matchTrade(transcript);
      const safetyRisk = SAFETY_WORDS.some((word) => lower.includes(word));
      const urgency = safetyRisk || EMERGENCY_WORDS.some((word) => lower.includes(word))
        ? 'emergency'
        : tradeCode
          ? 'normal'
          : null;
      return Promise.resolve({
        tradeCode,
        confidence,
        urgency,
        timePreference: lower.includes('tomorrow') ? 'tomorrow' : lower.includes('today') ? 'today' : null,
        problemSummaryEn: transcript.slice(0, 140),
        safetyRisk,
        outOfScope: tradeCode === null && !safetyRisk && confidence < 0.3,
      });
    },
    places: {
      lookupPincode(pincode) {
        const info = FIXTURE_PINCODES[pincode];
        return Promise.resolve(
          info ? { officeName: info.officeName, stateCode: info.stateCode, location: { lng: 76.9, lat: 8.5 } } : null,
        );
      },
    },
    pricing: {
      quote({ estimatedMinutes, urgency }) {
        return Promise.resolve(
          quote({
            rates: {
              wageFloorPerHourPaise: 12_000,
              minBillableMinutes: 30,
              visitChargePaise: 5_000,
              emergencySurchargePct: '25.00',
            },
            stateConfig: { welfarePct: '5.00', platformFeePct: '5.00', gstPctOnPlatformFee: '18.00' },
            estimatedMinutes,
            urgency,
            isInstitution: false,
          }),
        );
      },
    },
    codes: {
      verifyJobOtp: (bookingId, kind, otp) => deriveJobOtp(DEV_SECRET, bookingId, kind) === otp,
      deriveJobOtp: (bookingId, kind) => deriveJobOtp(DEV_SECRET, bookingId, kind),
    },
    earnings: {
      today: () => Promise.resolve({ totalPaise: paise(1_450_00), jobCount: 3 }),
    },
    clock: { now: () => new Date() },
  };
}
