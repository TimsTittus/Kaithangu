/**
 * File helpers for the i18n scripts. Catalogs are read from disk (not the
 * package import) so a script sees the files as they are now.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Catalog, Locale } from '@kaithangu/i18n';
import { z } from 'zod';

const I18N_DIR = fileURLToPath(new URL('../../packages/i18n/', import.meta.url));

export const NEEDS_REVIEW_PATH = `${I18N_DIR}needs_review.json`;
export const AUDIO_KEYS_PATH = `${I18N_DIR}audio-keys.json`;

export const catalogPath = (locale: Locale): string => `${I18N_DIR}src/catalogs/${locale}.json`;

export function readCatalog(locale: Locale): Catalog {
  return JSON.parse(readFileSync(catalogPath(locale), 'utf8')) as Catalog;
}

export function writeCatalog(locale: Locale, catalog: Catalog): void {
  writeFileSync(catalogPath(locale), `${JSON.stringify(catalog, null, 2)}\n`);
}

/** [dot.path, message] for every leaf, in file order. */
export function leafEntries(catalog: Catalog, prefix = ''): [string, string][] {
  return Object.entries(catalog).flatMap(([key, value]): [string, string][] => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return typeof value === 'string' ? [[path, value]] : leafEntries(value, path);
  });
}

export function setLeaf(catalog: Catalog, path: string, message: string): void {
  const parts = path.split('.');
  const last = parts.pop();
  if (last === undefined) throw new Error(`empty key path`);
  let node = catalog;
  for (const part of parts) {
    const next = node[part];
    if (typeof next === 'string') throw new Error(`${path}: ${part} is a message, not a namespace`);
    node = next ?? (node[part] = {});
  }
  node[last] = message;
}

/** `catalog` with keys in the order of `reference`; keys only in `catalog` go last. */
export function orderLike(reference: Catalog, catalog: Catalog): Catalog {
  const ordered: Catalog = {};
  for (const [key, value] of Object.entries(reference)) {
    const own = catalog[key];
    if (own === undefined) continue;
    ordered[key] =
      typeof value === 'object' && typeof own === 'object' ? orderLike(value, own) : own;
  }
  for (const [key, value] of Object.entries(catalog)) {
    if (!(key in ordered)) ordered[key] = value;
  }
  return ordered;
}

/** `{name}` placeholders of a message, sorted. */
export function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

const needsReviewSchema = z.record(z.string(), z.array(z.string()));
export type NeedsReview = z.output<typeof needsReviewSchema>;

/** Machine-translated keys per locale awaiting review by a native speaker. */
export function readNeedsReview(): NeedsReview {
  if (!existsSync(NEEDS_REVIEW_PATH)) return {};
  return needsReviewSchema.parse(JSON.parse(readFileSync(NEEDS_REVIEW_PATH, 'utf8')));
}

export function writeNeedsReview(review: NeedsReview): void {
  const sorted = Object.fromEntries(
    Object.keys(review)
      .sort()
      .map((locale) => [locale, [...new Set(review[locale])].sort()]),
  );
  writeFileSync(NEEDS_REVIEW_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}
