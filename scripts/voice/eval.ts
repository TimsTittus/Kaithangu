/**
 * Voice extraction evaluator (Phase 7 spec): runs tests/voice-corpus/labels.jsonl
 * through STT (for audio rows) + LLM extraction, scores trade/urgency/out-of-scope
 * accuracy per locale, and writes reports/voice-eval-YYYYMMDD.md — never
 * overwriting a previous day's report (or a previous run the same day).
 *
 * Run: bun run voice:eval
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLlmAdapter } from '@kaithangu/adapters/llm';
import { createSpeechAdapter } from '@kaithangu/adapters/speech';
import { extractProblem, type TradeCode } from '@kaithangu/core';
import { isSupportedLocale, type Locale } from '@kaithangu/i18n';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, '..', '..', 'tests', 'voice-corpus');
const LABELS_PATH = join(CORPUS_DIR, 'labels.jsonl');
const REPORTS_DIR = join(HERE, '..', '..', 'reports');

interface ExpectedLabel {
  tradeCode: TradeCode | null;
  urgency: 'normal' | 'emergency' | null;
  outOfScope: boolean;
}

interface LabelRow {
  id: string;
  locale: string;
  text?: string;
  audioPath?: string;
  expected: ExpectedLabel;
}

interface RowResult {
  id: string;
  locale: Locale;
  sttMs: number;
  extractMs: number;
  tradeCorrect: boolean;
  urgencyCorrect: boolean;
  outOfScopeCorrect: boolean;
}

function readLabels(): LabelRow[] {
  const raw = readFileSync(LABELS_PATH, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LabelRow);
}

async function evaluateRow(
  row: LabelRow,
  deps: { speech: ReturnType<typeof createSpeechAdapter>; llm: ReturnType<typeof createLlmAdapter> },
): Promise<RowResult | { skipped: true; id: string; reason: string }> {
  if (!isSupportedLocale(row.locale)) {
    return { skipped: true, id: row.id, reason: `unsupported locale ${row.locale}` };
  }
  const locale = row.locale;

  let transcript: string;
  let sttMs = 0;
  if (row.text !== undefined) {
    transcript = row.text;
  } else if (row.audioPath) {
    const audioFile = join(CORPUS_DIR, row.audioPath);
    if (!existsSync(audioFile)) {
      return { skipped: true, id: row.id, reason: `audio sample not found: ${row.audioPath}` };
    }
    const sttStart = performance.now();
    const audio = new Uint8Array(readFileSync(audioFile));
    const { transcript: t } = await deps.speech.transcribe({ audio, mimeType: 'audio/webm', locale });
    sttMs = performance.now() - sttStart;
    transcript = t;
  } else {
    return { skipped: true, id: row.id, reason: 'row has neither text nor audioPath' };
  }

  const extractStart = performance.now();
  const result = await extractProblem({ transcript, locale }, deps.llm);
  const extractMs = performance.now() - extractStart;

  return {
    id: row.id,
    locale,
    sttMs,
    extractMs,
    tradeCorrect: result.tradeCode === row.expected.tradeCode,
    urgencyCorrect: result.urgency === row.expected.urgency,
    outOfScopeCorrect: result.outOfScope === row.expected.outOfScope,
  };
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(count: number, total: number): string {
  return total === 0 ? 'n/a' : `${((count / total) * 100).toFixed(1)}%`;
}

function reportPath(): string {
  const today = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  let candidate = join(REPORTS_DIR, `voice-eval-${today}.md`);
  let suffix = 2;
  while (existsSync(candidate)) {
    candidate = join(REPORTS_DIR, `voice-eval-${today}-${suffix}.md`);
    suffix += 1;
  }
  return candidate;
}

function buildReport(results: RowResult[], skipped: { id: string; reason: string }[]): string {
  const byLocale = new Map<Locale, RowResult[]>();
  for (const r of results) {
    const list = byLocale.get(r.locale) ?? [];
    list.push(r);
    byLocale.set(r.locale, list);
  }

  const lines: string[] = [
    `# Voice extraction evaluation — ${new Date().toISOString()}`,
    '',
    `Corpus: \`tests/voice-corpus/labels.jsonl\` — ${results.length} evaluated, ${skipped.length} skipped.`,
    '',
    '| Locale | N | Trade accuracy | Urgency accuracy | Out-of-scope accuracy | Avg STT ms | Avg extract ms |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const [locale, rows] of byLocale) {
    lines.push(
      `| ${locale} | ${rows.length} | ${pct(rows.filter((r) => r.tradeCorrect).length, rows.length)} | ${pct(
        rows.filter((r) => r.urgencyCorrect).length,
        rows.length,
      )} | ${pct(rows.filter((r) => r.outOfScopeCorrect).length, rows.length)} | ${average(
        rows.map((r) => r.sttMs),
      ).toFixed(1)} | ${average(rows.map((r) => r.extractMs)).toFixed(1)} |`,
    );
  }

  if (skipped.length > 0) {
    lines.push('', '## Skipped rows', '');
    for (const s of skipped) lines.push(`- \`${s.id}\`: ${s.reason}`);
  }

  lines.push(
    '',
    '_Accuracy numbers reflect whatever LLM_MODE/SPEECH_MODE were active when this ran — mock adapters score against their fixed canned responses, not real understanding. Run with real keys (LLM_MODE=real, SPEECH_MODE=real) for a meaningful number._',
  );

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const deps = {
    speech: createSpeechAdapter({ env: process.env }),
    llm: createLlmAdapter({ env: process.env }),
  };

  const rows = readLabels();
  const results: RowResult[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const row of rows) {
    const outcome = await evaluateRow(row, deps);
    if ('skipped' in outcome) {
      skipped.push({ id: outcome.id, reason: outcome.reason });
    } else {
      results.push(outcome);
    }
  }

  const report = buildReport(results, skipped);
  const path = reportPath();
  writeFileSync(path, report, 'utf8');
  console.log(report);
  console.log(`Written to ${path}`);
}

await main();
