`labels.jsonl` rows are text-only English examples I authored directly (safe — no invented non-English content). Each line:

```json
{"id": "...", "locale": "en", "text": "...", "expected": {"tradeCode": "plumber"|null, "urgency": "normal"|"emergency"|null, "outOfScope": true|false}}
```

An `audioPath` field (relative to this directory) is supported instead of `text`, transcribed via the speech adapter before extraction — but no `samples/*.wav` corpus has been supplied yet, so `voice:eval` skips any row with `audioPath` and reports it separately, rather than fabricating audio.

Do not add `ml`/`hi`/`ta` rows here until real transcripts (from actual recordings or explicitly-provided text) are available — see `packages/i18n/src/trade-synonyms/README.md` for the same rule applied to synonym data.
