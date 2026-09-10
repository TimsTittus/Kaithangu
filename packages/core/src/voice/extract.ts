/**
 * LLM-based problem extraction for the customer_booking flow (Phase 7 spec).
 * Prompt is packages/core/src/voice/prompts/extract.md, versioned; invalid
 * JSON or a schema mismatch gets one retry with the validation error appended,
 * then falls back to "not understood" (confidence 0, tradeCode null) so the
 * flow clarifies instead of guessing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { LlmAdapter } from '@kaithangu/adapters/llm/types';
import type { Locale } from '@kaithangu/i18n';
import { tradeSynonyms } from '@kaithangu/i18n/tradeSynonyms';
import { TRADE_CODES } from '../trades';
import type { ExtractResult } from './types';

const PROMPT_PATH = fileURLToPath(new URL('./prompts/extract.md', import.meta.url));
const PROMPT_TEMPLATE = readFileSync(PROMPT_PATH, 'utf8');
const TRANSCRIPT_MARKER = '## Transcript';

const extractResultSchema = z.object({
  tradeCode: z.enum(TRADE_CODES).nullable(),
  confidence: z.number().min(0).max(1),
  urgency: z.enum(['normal', 'emergency']).nullable(),
  timePreference: z.enum(['now', 'today', 'tomorrow']).nullable(),
  problemSummaryEn: z.string().max(140),
  safetyRisk: z.boolean(),
  outOfScope: z.boolean(),
}) satisfies z.ZodType<ExtractResult>;

const NOT_UNDERSTOOD: ExtractResult = {
  tradeCode: null,
  confidence: 0,
  urgency: null,
  timePreference: null,
  problemSummaryEn: '',
  safetyRisk: false,
  outOfScope: false,
};

function systemPrompt(locale: Locale): string {
  const marker = PROMPT_TEMPLATE.indexOf(TRANSCRIPT_MARKER);
  const withoutTranscriptSection = marker === -1 ? PROMPT_TEMPLATE : PROMPT_TEMPLATE.slice(0, marker);
  const catalogue = tradeSynonyms[locale];
  return withoutTranscriptSection
    .replace('{{locale}}', locale)
    .replace('{{tradeCatalogue}}', JSON.stringify(catalogue));
}

function parseExtraction(raw: string): { ok: true; value: ExtractResult } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'response was not valid JSON' };
  }
  const result = extractResultSchema.safeParse(json);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, value: result.data };
}

export interface ExtractInput {
  transcript: string;
  locale: Locale;
}

export async function extractProblem(input: ExtractInput, llm: LlmAdapter): Promise<ExtractResult> {
  const system = systemPrompt(input.locale);

  const first = await llm.complete({ system, prompt: input.transcript });
  const firstResult = parseExtraction(first);
  if (firstResult.ok) return firstResult.value;

  const retry = await llm.complete({
    system: `${system}\n\nYour previous response was invalid: ${firstResult.error}. Return ONLY the JSON object, matching the schema exactly.`,
    prompt: input.transcript,
  });
  const retryResult = parseExtraction(retry);
  return retryResult.ok ? retryResult.value : NOT_UNDERSTOOD;
}
