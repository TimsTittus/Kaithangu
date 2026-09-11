'use client';

import { Volume2 } from 'lucide-react';
import { useCommonStrings } from './CommonStrings';
import { iconButtonClass } from './ui';

const SPEECH_LANG: Record<string, string> = {
  en: 'en-IN',
  ml: 'ml-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
};

/** Speak `text` with the browser's speech synthesis, if it has one. */
export function speak(text: string, locale: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG[locale] ?? 'en-IN';
  window.speechSynthesis.speak(utterance);
}

/**
 * Plays dynamic `text` aloud (e.g. a price). Fixed labels use AudioLabel,
 * which plays the pre-built mp3 for the key.
 */
export function AudioButton({ text, locale }: { text: string; locale?: string }) {
  const common = useCommonStrings();
  return (
    <button
      type="button"
      onClick={() => speak(text, locale ?? common.locale)}
      className={iconButtonClass}
      aria-label={`${common.playAudio}: ${text}`}
      title={common.playAudio}
    >
      <Volume2 aria-hidden className="size-6" />
    </button>
  );
}
