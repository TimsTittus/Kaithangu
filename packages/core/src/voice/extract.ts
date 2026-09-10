/**
 * LLM-based problem extraction for the customer_booking flow (Phase 7 spec).
 * Prompt is packages/core/src/voice/prompts/extract.md, versioned; invalid
 * JSON or a schema mismatch gets one retry with the validation error appended,
 * then falls back to "not understood" (confidence 0, tradeCode null) so the
 * flow clarifies instead of guessing.
 */
import { z } from 'zod';
import type { LlmAdapter } from '@kaithangu/adapters/llm/types';
import type { Locale } from '@kaithangu/i18n';
import { tradeSynonyms } from '@kaithangu/i18n/tradeSynonyms';
import { TRADE_CODES } from '../trades';
import type { ExtractResult } from './types';

const PROMPT_TEMPLATE = `<!-- extract.md v1 — voice problem-description extraction prompt (packages/core/src/voice/extract.ts) -->
You extract structured information from what a customer said when asked "What help do you need?" on a phone call to Kaithangu, a home-services booking service in India.

Return ONLY a single JSON object, no prose, matching exactly this shape:

\`\`\`
{
  "tradeCode": one of ["plumber","electrician","carpenter","painter","domestic_help","caregiver","driver","gardener","cleaner","technician"] or null,
  "confidence": number from 0 to 1,
  "urgency": "normal" | "emergency" | null,
  "timePreference": "now" | "today" | "tomorrow" | null,
  "problemSummaryEn": a short English summary of the problem, at most 140 characters,
  "safetyRisk": true if the caller mentions gas smell, sparks, fire, flooding, or another immediate physical danger, else false,
  "outOfScope": true if the request has nothing to do with any of the trades above, else false
}
\`\`\`

Rules:
- Set "tradeCode" to null and "confidence" low (under 0.6) if the trade is unclear or ambiguous — a clarification question will be asked instead of guessing.
- "safetyRisk" true always forces "urgency" to "emergency", regardless of what the caller said.
- "problemSummaryEn" is always in English, even if the caller spoke another language — translate, don't transliterate.
- The trade catalogue with synonyms for this call's locale is provided below; use it to match trade-specific words, but do not treat it as the only valid phrasing — everyday descriptions of the same problem should still match.

## Few-shot examples

1. Transcript: "My kitchen tap has been leaking since morning."
   \`{"tradeCode":"plumber","confidence":0.95,"urgency":"normal","timePreference":null,"problemSummaryEn":"Kitchen tap leaking since morning","safetyRisk":false,"outOfScope":false}\`

2. Transcript: "There's a burning smell from the fuse box and I see sparks."
   \`{"tradeCode":"electrician","confidence":0.9,"urgency":"emergency","timePreference":"now","problemSummaryEn":"Burning smell and sparks from fuse box","safetyRisk":true,"outOfScope":false}\`

3. Transcript: "I smell gas in my kitchen."
   \`{"tradeCode":null,"confidence":0.3,"urgency":"emergency","timePreference":"now","problemSummaryEn":"Caller smells gas in the kitchen","safetyRisk":true,"outOfScope":false}\`

4. Transcript: "Can someone come clean my house tomorrow, deep cleaning please."
   \`{"tradeCode":"cleaner","confidence":0.9,"urgency":"normal","timePreference":"tomorrow","problemSummaryEn":"Deep cleaning requested for tomorrow","safetyRisk":false,"outOfScope":false}\`

5. Transcript: "My washing machine stopped working, it just won't turn on."
   \`{"tradeCode":"technician","confidence":0.85,"urgency":"normal","timePreference":null,"problemSummaryEn":"Washing machine not turning on","safetyRisk":false,"outOfScope":false}\`

6. Transcript: "Something is broken at home, not sure who to call."
   \`{"tradeCode":null,"confidence":0.15,"urgency":null,"timePreference":null,"problemSummaryEn":"Caller says something is broken, unspecified","safetyRisk":false,"outOfScope":false}\`

7. Transcript: "I want to order a pizza."
   \`{"tradeCode":null,"confidence":0.1,"urgency":null,"timePreference":null,"problemSummaryEn":"Caller asked about ordering food, unrelated to home services","safetyRisk":false,"outOfScope":true}\`

8. Transcript: "My bathroom is flooding, water everywhere, please send someone right now."
   \`{"tradeCode":"plumber","confidence":0.9,"urgency":"emergency","timePreference":"now","problemSummaryEn":"Bathroom flooding, urgent","safetyRisk":true,"outOfScope":false}\`

## Trade catalogue (locale: {{locale}})

{{tradeCatalogue}}

## Transcript

{{transcript}}
`;
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
