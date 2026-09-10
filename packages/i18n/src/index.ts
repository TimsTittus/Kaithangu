import en from './catalogs/en.json';
import hi from './catalogs/hi.json';
import ml from './catalogs/ml.json';
import ta from './catalogs/ta.json';

export const SUPPORTED_LOCALES = ['en', 'ml', 'hi', 'ta'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Nested message catalog; keys are dot paths such as `trade.plumber`. */
export interface Catalog {
  [key: string]: string | Catalog;
}

export const catalogs: Readonly<Record<Locale, Catalog>> = { en, ml, hi, ta };

/** Every leaf key of a catalog as a dot path, sorted. */
export function messageKeys(catalog: Catalog, prefix = ''): string[] {
  return Object.entries(catalog)
    .flatMap(([key, value]) => {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      return typeof value === 'string' ? [path] : messageKeys(value, path);
    })
    .sort();
}

export function hasMessage(locale: Locale, key: string): boolean {
  let node: string | Catalog | undefined = catalogs[locale];
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return false;
    node = node[part];
  }
  return typeof node === 'string';
}
