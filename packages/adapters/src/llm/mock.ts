import type { LlmAdapter } from './types';

/**
 * Offline LLM adapter: always returns a fixed "nothing extracted" JSON
 * payload shaped like extract.ts's schema. Tests and the simulator that want
 * specific extraction results inject their own fake LlmAdapter instead of
 * this one — this exists only so `ADAPTER_MODE=mock` (the default) never
 * makes a network call.
 */
const NOT_UNDERSTOOD_JSON = JSON.stringify({
  tradeCode: null,
  confidence: 0,
  urgency: null,
  timePreference: null,
  problemSummaryEn: '',
  safetyRisk: false,
  outOfScope: false,
});

export function createMockLlmAdapter(): LlmAdapter {
  return {
    complete() {
      return Promise.resolve(NOT_UNDERSTOOD_JSON);
    },
  };
}
