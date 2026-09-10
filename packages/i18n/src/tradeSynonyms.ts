import en from './trade-synonyms/en.json' with { type: 'json' };
import hi from './trade-synonyms/hi.json' with { type: 'json' };
import ml from './trade-synonyms/ml.json' with { type: 'json' };
import ta from './trade-synonyms/ta.json' with { type: 'json' };
import type { Locale } from './index';

/** Synonym phrases per trade code, used by voice LLM extraction. */
export type TradeSynonyms = Readonly<Record<string, readonly string[]>>;

export const tradeSynonyms: Readonly<Record<Locale, TradeSynonyms>> = { en, ml, hi, ta };
