/**
 * Audio labels: one mp3 per (locale, key) for the keys in
 * packages/i18n/audio-keys.json, spoken by the speech adapter's TTS (mock
 * writes a short silent mp3). Output: apps/web/public/audio/{locale}/{key}.mp3,
 * plus {locale}/index.json (keys, for the service worker's precache) and
 * manifest.json (content hash per file). Files whose text and adapter mode are
 * unchanged are skipped.
 *
 *   bun run audio:build
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveAdapterMode } from '@kaithangu/adapters';
import { createSpeechAdapter } from '@kaithangu/adapters/speech';
import { SUPPORTED_LOCALES } from '@kaithangu/i18n';
import { z } from 'zod';
import { AUDIO_KEYS_PATH, leafEntries, readCatalog } from '../i18n/catalog';

const OUT_DIR = fileURLToPath(new URL('../../apps/web/public/audio/', import.meta.url));
const MANIFEST_PATH = `${OUT_DIR}manifest.json`;

const audioKeys = z
  .array(z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/))
  .parse(JSON.parse(readFileSync(AUDIO_KEYS_PATH, 'utf8')));
const manifestSchema = z.record(z.string(), z.string());

async function main(): Promise<void> {
  const mode = resolveAdapterMode(process.env, 'speech');
  const speech = createSpeechAdapter({ env: process.env });
  const manifest = existsSync(MANIFEST_PATH)
    ? manifestSchema.parse(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')))
    : {};
  const next: Record<string, string> = {};
  let written = 0;
  let skipped = 0;

  for (const locale of SUPPORTED_LOCALES) {
    const messages = new Map(leafEntries(readCatalog(locale)));
    mkdirSync(`${OUT_DIR}${locale}`, { recursive: true });
    for (const key of audioKeys) {
      const text = messages.get(key);
      if (text === undefined) throw new Error(`audio key ${locale}:${key} is not in the catalog`);
      const id = `${locale}/${key}`;
      const file = `${OUT_DIR}${id}.mp3`;
      const hash = createHash('sha256')
        .update(JSON.stringify({ mode, locale, text }))
        .digest('hex');
      next[id] = hash;
      if (manifest[id] === hash && existsSync(file)) {
        skipped += 1;
        continue;
      }
      writeFileSync(file, await speech.synthesize({ text, locale }));
      written += 1;
    }
    writeFileSync(`${OUT_DIR}${locale}/index.json`, `${JSON.stringify(audioKeys, null, 2)}\n`);
  }

  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`audio labels (${mode}): ${written} written, ${skipped} unchanged`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
