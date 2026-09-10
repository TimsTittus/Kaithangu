'use client';

import { Volume2 } from 'lucide-react';
import { speak } from './AudioButton';
import { useCommonStrings } from './CommonStrings';
import { iconButtonClass } from './ui';

/**
 * 48 px speaker button that plays the pre-built label audio
 * /audio/{locale}/{k}.mp3 (scripts/audio/build.ts). Never autoplays. If the
 * file cannot play, the browser's speech synthesis reads `text` instead.
 */
export function AudioLabel({ k, text }: { k: string; text: string }) {
  const { locale, playAudio } = useCommonStrings();

  function play() {
    const audio = new Audio(`/audio/${locale}/${k}.mp3`);
    audio.play().catch(() => speak(text, locale));
  }

  return (
    <button
      type="button"
      onClick={play}
      className={iconButtonClass}
      aria-label={`${playAudio}: ${text}`}
      title={playAudio}
      data-testid={`audio-${k}`}
    >
      <Volume2 aria-hidden className="size-6" />
    </button>
  );
}
