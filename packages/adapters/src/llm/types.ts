/**
 * LLM adapter interface: a single text-completion call. Voice extraction
 * (packages/core/voice/extract.ts) is the only current consumer — it owns
 * prompting and JSON-schema validation, so this adapter stays a thin,
 * provider-agnostic transport (mock, real = whatever LLM_PROVIDER selects).
 */
export interface LlmCompleteInput {
  system: string;
  prompt: string;
  /** Caps provider spend/latency per call; providers may clamp further. */
  maxTokens?: number;
}

export interface LlmAdapter {
  /** Raw text response (the caller parses/validates it, e.g. as JSON). */
  complete(input: LlmCompleteInput): Promise<string>;
}
