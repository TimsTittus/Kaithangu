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

/**
 * Plays `text` aloud (AGENTS.md 7: every primary action has an audio button).
 * Placeholder: uses the browser's speech synthesis when it has a voice for the
 * language; recorded prompts from packages/i18n replace this with the voice phase.
 */
export function AudioButton({ text, locale }: { text: string; locale?: string }) {
  const common = useCommonStrings();
  const lang = SPEECH_LANG[locale ?? common.locale] ?? 'en-IN';

  function play() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={play}
      className={iconButtonClass}
      aria-label={`${common.playAudio}: ${text}`}
      title={common.playAudio}
    >
      <Volume2 aria-hidden className="size-6" />
    </button>
  );
}
