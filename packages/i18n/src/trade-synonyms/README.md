`en.json` is a seed set of real English synonyms per trade, safe to author directly.

`ml.json` / `hi.json` / `ta.json` are intentionally empty until real content is available:
transcripts from `tests/voice-corpus` plus machine translations explicitly marked
`needs_review` (see `packages/i18n/needs_review.json` for the existing convention).
Do not fill these with invented phrases — extraction for these locales falls back to
the English synonyms plus whatever the LLM already knows until real corpus data lands.
