'use client';

import { Volume2 } from 'lucide-react';
import { speak } from './AudioButton';
import { useCommonStrings } from './CommonStrings';
import { iconButtonClass } from './ui';

/**
 * 48 px speaker button that reads a fixed label aloud with the browser's
 * speech synthesis, in the active locale's voice.
 *
 * It used to play a pre-built /audio/{locale}/{k}.mp3 and fall back to speech
 * only when that failed. Every one of those files was the same silent
 * placeholder, so playback always "succeeded" and the fallback never ran —
 * every button was silent. The mp3s are gone; when real recordings exist,
 * restore the file-first path here and keep speech as the fallback.
 */
export function AudioLabel({ k, text }: { k: string; text: string }) {
  const { locale, playAudio } = useCommonStrings();

  return (
    <button
      type="button"
      onClick={() => speak(text, locale)}
      className={iconButtonClass}
      aria-label={`${playAudio}: ${text}`}
      title={playAudio}
      data-testid={`audio-${k}`}
    >
      <Volume2 aria-hidden className="size-6" />
    </button>
  );
}
