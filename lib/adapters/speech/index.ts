import { resolveAdapterMode } from '../index';
import { createMockSpeechAdapter } from './mock';
import { createRealSpeechAdapter } from './real';
import type { SpeechAdapter } from './types';

export { createMockSpeechAdapter, silentMp3 } from './mock';
export { createRealSpeechAdapter, type RealSpeechOptions } from './real';
export {
  SPEECH_LANGUAGE_CODES,
  type SpeechAdapter,
  type SynthesizeInput,
  type TranscribeInput,
  type TranslateInput,
} from './types';

export interface SpeechAdapterOptions {
  env: Readonly<Record<string, string | undefined>>;
  fetch?: typeof fetch;
}

/** The speech adapter selected by SPEECH_MODE, else ADAPTER_MODE, else mock. */
export function createSpeechAdapter({ env, fetch }: SpeechAdapterOptions): SpeechAdapter {
  return resolveAdapterMode(env, 'speech') === 'real'
    ? createRealSpeechAdapter({ apiKey: env.SARVAM_API_KEY, fetch })
    : createMockSpeechAdapter();
}
