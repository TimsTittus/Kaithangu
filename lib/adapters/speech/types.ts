/**
 * Speech adapter interface (AGENTS.md 3, 4.5): speech-to-text, text-to-speech
 * and translation. Services depend on this file only; implementations (mock,
 * real = Sarvam) are chosen by SPEECH_MODE / ADAPTER_MODE.
 */
import type { Locale } from '@/lib/i18n';

export interface TranscribeInput {
  audio: Uint8Array;
  /** Base MIME type without parameters, e.g. audio/webm. */
  mimeType: string;
  locale: Locale;
}

export interface SynthesizeInput {
  text: string;
  locale: Locale;
}

export interface TranslateInput {
  text: string;
  from: Locale;
  to: Locale;
}

export interface SpeechAdapter {
  transcribe(input: TranscribeInput): Promise<{ transcript: string }>;
  /** MP3 audio of `text` spoken in `locale`. */
  synthesize(input: SynthesizeInput): Promise<Uint8Array>;
  translate(input: TranslateInput): Promise<string>;
}

/** BCP-47 codes the speech provider uses for each catalog locale. */
export const SPEECH_LANGUAGE_CODES: Readonly<Record<Locale, string>> = {
  en: 'en-IN',
  ml: 'ml-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
};
