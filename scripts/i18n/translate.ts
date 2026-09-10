/**
 * Fill keys missing from the ml/hi/ta catalogs by machine-translating the
 * English source with the speech adapter (Sarvam translate in real mode; mock
 * returns "[ml] <english>"). Existing translations are never overwritten;
 * mock placeholders are.
 * Every key written here is listed in packages/i18n/needs_review.json for a
 * native speaker to review. If a translation loses a {placeholder}, the
 * English text is kept (still listed for review).
 *
 *   bun run i18n:translate      (SPEECH_MODE / ADAPTER_MODE select the adapter)
 */
import { createSpeechAdapter } from '@kaithangu/adapters/speech';
import type { Locale } from '@kaithangu/i18n';
import {
  leafEntries,
  orderLike,
  placeholders,
  readCatalog,
  readNeedsReview,
  setLeaf,
  writeCatalog,
  writeNeedsReview,
} from './catalog';

const TARGET_LOCALES: readonly Locale[] = ['ml', 'hi', 'ta'];

async function main(): Promise<void> {
  const speech = createSpeechAdapter({ env: process.env });
  const english = readCatalog('en');
  const review = readNeedsReview();

  for (const locale of TARGET_LOCALES) {
    const catalog = readCatalog(locale);
    // Values left by the mock adapter ("[ml] <english>") count as missing, so
    // a later real-mode run replaces them with actual translations.
    const mockTag = `[${locale}] `;
    const present = new Set(
      leafEntries(catalog)
        .filter(([, message]) => !message.startsWith(mockTag))
        .map(([key]) => key),
    );
    const added: string[] = [];
    for (const [key, source] of leafEntries(english)) {
      if (present.has(key)) continue;
      const translated = await speech.translate({ text: source, from: 'en', to: locale });
      const keepsPlaceholders =
        placeholders(translated).join(',') === placeholders(source).join(',');
      if (!keepsPlaceholders) console.warn(`${locale}:${key} lost a placeholder; kept English`);
      setLeaf(catalog, key, keepsPlaceholders && translated.trim() !== '' ? translated : source);
      added.push(key);
    }
    writeCatalog(locale, orderLike(english, catalog));
    review[locale] = [...(review[locale] ?? []), ...added];
    console.log(`${locale}: ${added.length} key(s) machine-translated`);
  }
  writeNeedsReview(review);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
