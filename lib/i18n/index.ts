import en from './catalogs/en.json' with { type: 'json' };
import hi from './catalogs/hi.json' with { type: 'json' };
import ml from './catalogs/ml.json' with { type: 'json' };
import ta from './catalogs/ta.json' with { type: 'json' };

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

/** The message at a dot-path key, or undefined when the key is not a leaf. */
export function getMessage(locale: Locale, key: string): string | undefined {
  let node: string | Catalog | undefined = catalogs[locale];
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function hasMessage(locale: Locale, key: string): boolean {
  return getMessage(locale, key) !== undefined;
}

export type MessageParams = Readonly<Record<string, string | number>>;

/**
 * Render a message with simple `{name}` placeholders (the subset of ICU used by
 * SMS and voice text outside React). Throws on a missing key or parameter so a
 * broken template is never sent to a user.
 */
export function formatMessage(locale: Locale, key: string, params: MessageParams = {}): string {
  const message = getMessage(locale, key);
  if (message === undefined) {
    throw new Error(`i18n: missing message ${locale}:${key}`);
  }
  return message.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`i18n: missing parameter {${name}} for ${locale}:${key}`);
    }
    return String(value);
  });
}
