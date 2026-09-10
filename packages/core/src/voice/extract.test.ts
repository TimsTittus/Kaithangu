import { describe, expect, it } from 'vitest';
import type { LlmAdapter } from '@kaithangu/adapters/llm/types';
import { extractProblem } from './extract';

function fakeLlm(responses: string[]): LlmAdapter {
  let call = 0;
  return {
    complete: () => Promise.resolve(responses[Math.min(call++, responses.length - 1)] ?? ''),
  };
}

const VALID_PLUMBER = JSON.stringify({
  tradeCode: 'plumber',
  confidence: 0.9,
  urgency: 'normal',
  timePreference: null,
  problemSummaryEn: 'Leaking tap',
  safetyRisk: false,
  outOfScope: false,
});

describe('extractProblem', () => {
  it('returns the validated result on a clean first response', async () => {
    const llm = fakeLlm([VALID_PLUMBER]);
    const result = await extractProblem({ transcript: 'tap is leaking', locale: 'en' }, llm);
    expect(result.tradeCode).toBe('plumber');
    expect(result.confidence).toBe(0.9);
  });

  it('retries once on invalid JSON, then succeeds', async () => {
    const llm = fakeLlm(['not json at all', VALID_PLUMBER]);
    const result = await extractProblem({ transcript: 'tap is leaking', locale: 'en' }, llm);
    expect(result.tradeCode).toBe('plumber');
  });

  it('retries once on a schema mismatch, then succeeds', async () => {
    const llm = fakeLlm([JSON.stringify({ tradeCode: 'not_a_trade' }), VALID_PLUMBER]);
    const result = await extractProblem({ transcript: 'tap is leaking', locale: 'en' }, llm);
    expect(result.tradeCode).toBe('plumber');
  });

  it('falls back to not-understood after two failures', async () => {
    const llm = fakeLlm(['garbage', 'still garbage']);
    const result = await extractProblem({ transcript: 'unclear', locale: 'en' }, llm);
    expect(result).toEqual({
      tradeCode: null,
      confidence: 0,
      urgency: null,
      timePreference: null,
      problemSummaryEn: '',
      safetyRisk: false,
      outOfScope: false,
    });
  });
});
