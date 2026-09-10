/**
 * Gemini LLM adapter: a single text-completion call against the Google
 * Generative Language API. Voice extraction owns prompting/parsing; this
 * adapter is a thin transport, matching the fetch-based pattern in
 * speech/real.ts (no SDK dependency).
 */
import { z } from 'zod';
import { NotConfiguredError } from '../notConfigured';
import type { LlmAdapter, LlmCompleteInput } from './types';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 30_000;

const geminiResponse = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })).default([]),
        }),
      }),
    )
    .min(1),
});

export interface RealLlmOptions {
  apiKey: string | undefined;
  model?: string | undefined;
  fetch?: typeof fetch;
}

export function createRealLlmAdapter({
  apiKey,
  model = DEFAULT_MODEL,
  fetch: fetchImpl = fetch,
}: RealLlmOptions): LlmAdapter {
  return {
    async complete({ system, prompt, maxTokens }: LlmCompleteInput): Promise<string> {
      if (apiKey === undefined || apiKey === '') throw new NotConfiguredError('llm');

      const response = await fetchImpl(
        `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        throw new Error(`gemini generateContent failed with HTTP ${response.status}`);
      }
      const parsed = geminiResponse.parse(await response.json());
      const text = parsed.candidates[0]?.content.parts.map((p) => p.text ?? '').join('') ?? '';
      return text;
    },
  };
}
