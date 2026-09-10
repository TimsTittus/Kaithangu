/**
 * Catalog lint (part of `bun run lint`): fails when a catalog is missing any
 * key present in the English source, or has keys English does not have.
 * Also warns about needs_review.json entries for keys that no longer exist.
 */
import { SUPPORTED_LOCALES } from '@kaithangu/i18n';
import { leafEntries, readCatalog, readNeedsReview } from './catalog';

const englishKeys = new Set(leafEntries(readCatalog('en')).map(([key]) => key));
let failed = false;

for (const locale of SUPPORTED_LOCALES) {
  if (locale === 'en') continue;
  const keys = new Set(leafEntries(readCatalog(locale)).map(([key]) => key));
  const missing = [...englishKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !englishKeys.has(key));
  if (missing.length > 0) {
    failed = true;
    console.error(`${locale}: missing ${missing.length} key(s): ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    failed = true;
    console.error(`${locale}: ${extra.length} key(s) not in en: ${extra.join(', ')}`);
  }
}

for (const [locale, keys] of Object.entries(readNeedsReview())) {
  const stale = keys.filter((key) => !englishKeys.has(key));
  if (stale.length > 0) console.warn(`needs_review ${locale}: stale key(s): ${stale.join(', ')}`);
}

if (failed) {
  console.error('Run `bun run i18n:translate` to fill missing keys.');
  process.exit(1);
}
console.log(
  `i18n catalogs complete (${englishKeys.size} keys × ${SUPPORTED_LOCALES.length} locales)`,
);
