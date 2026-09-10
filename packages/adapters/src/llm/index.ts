import { resolveAdapterMode } from '../index';
import { createMockLlmAdapter } from './mock';
import { createRealLlmAdapter } from './real';
import type { LlmAdapter } from './types';

export { createMockLlmAdapter } from './mock';
export { createRealLlmAdapter, type RealLlmOptions } from './real';
export type { LlmAdapter, LlmCompleteInput } from './types';

export interface LlmAdapterOptions {
  env: Readonly<Record<string, string | undefined>>;
  fetch?: typeof fetch;
}

/** The LLM adapter selected by LLM_MODE, else ADAPTER_MODE, else mock. Real = Gemini. */
export function createLlmAdapter({ env, fetch }: LlmAdapterOptions): LlmAdapter {
  return resolveAdapterMode(env, 'llm') === 'real'
    ? createRealLlmAdapter({ apiKey: env.LLM_API_KEY, model: env.LLM_MODEL, fetch })
    : createMockLlmAdapter();
}
