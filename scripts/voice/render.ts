import { formatMessage, hasMessage, type Locale } from '@kaithangu/i18n';
import type { VoicePrompt } from '@kaithangu/core';

/** Renders a VoicePrompt as text; falls back to the raw key+params for prompts not yet in the catalog. */
export function renderPrompt(locale: Locale, prompt: VoicePrompt): string {
  const params = prompt.params ?? {};
  if (hasMessage(locale, prompt.key)) {
    return formatMessage(locale, prompt.key, params);
  }
  const paramsText = Object.keys(params).length > 0 ? ` ${JSON.stringify(params)}` : '';
  return `[${prompt.key}]${paramsText}`;
}
