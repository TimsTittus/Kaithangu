/**
 * Voice flow simulator (Phase 7 spec).
 *
 *   bun run voice:sim -- --flow customer_booking --locale ml [--phone +91...]
 *     REPL: type text for a speech event, "#1234" for dtmf, "/timeout" for a
 *     timeout event, "/hangup" or "/quit" to end. Runs entirely offline
 *     against fixture deps (scripts/voice/deps.ts) — no DB, no API keys.
 *
 *   bun run voice:sim -- --script tests/voice-scripts/*.yaml
 *     Scripted dialogs: each YAML file drives a flow through fixed turns and
 *     asserts the resulting prompt keys / action types, for CI.
 */
import { createInterface } from 'node:readline/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  customerBookingFlow,
  statusUpdateFlow,
  workerAvailabilityFlow,
  workerJobFlow,
  workerOfferFlow,
  type ActiveJob,
  type Flow,
  type FlowContext,
  type JobOffer,
  type VoiceEvent,
  type VoiceTurn,
} from '@kaithangu/core';
import { isSupportedLocale, type Locale } from '@kaithangu/i18n';
import { buildSimDeps } from './deps';
import { renderPrompt } from './render';

const FIXTURE_JOB: ActiveJob = {
  bookingId: 'sim-booking-1',
  workerId: 'sim-worker-1',
  workerName: 'Ravi Kumar',
  tradeCode: 'plumber',
  societyName: 'Green Meadows',
  customerName: 'Anita',
  arrivalEstimateMinutes: 20,
};

const FIXTURE_OFFER: JobOffer = {
  offerId: '11111111-1111-1111-1111-111111111111',
  tradeCode: 'plumber',
  locality: 'Kowdiar',
  distanceKm: 2.4,
  wagePaise: 30_000,
};

type AnyFlow = Flow<unknown>;

const FLOWS: Record<string, AnyFlow> = {
  customer_booking: customerBookingFlow,
  status_update: statusUpdateFlow,
  worker_offer: workerOfferFlow,
  worker_availability: workerAvailabilityFlow,
  worker_job: workerJobFlow,
};

function buildContext(flowId: string, phone: string, locale: Locale | undefined): FlowContext {
  const base: FlowContext = { callerPhone: phone, knownLocale: locale };
  switch (flowId) {
    case 'status_update':
    case 'worker_job':
      return { ...base, activeJob: FIXTURE_JOB, workerId: FIXTURE_JOB.workerId };
    case 'worker_offer':
      return { ...base, offer: FIXTURE_OFFER };
    case 'worker_availability':
      return { ...base, workerId: FIXTURE_JOB.workerId };
    default:
      return base;
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg?.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

function parseEvent(line: string): VoiceEvent | null {
  const trimmed = line.trim();
  if (trimmed === '/timeout') return { type: 'timeout' };
  if (trimmed === '/hangup' || trimmed === '/quit' || trimmed === '/exit') return { type: 'hangup' };
  if (trimmed.startsWith('#')) return { type: 'dtmf', digits: trimmed.slice(1) };
  if (trimmed === '') return null;
  return { type: 'speech', transcript: trimmed };
}

function printTurn(locale: Locale, turn: VoiceTurn): void {
  for (const prompt of turn.prompts) {
    console.log(`  ${renderPrompt(locale, prompt)}`);
  }
  for (const action of turn.actions) {
    console.log(`  >> action: ${JSON.stringify(action)}`);
  }
  if (turn.expect) {
    console.log(`  [waiting: ${turn.expect.mode}${turn.expect.dtmfDigits ? ` x${turn.expect.dtmfDigits}` : ''}]`);
  }
}

async function runRepl(flowId: string, locale: Locale, phone: string): Promise<void> {
  const flow = FLOWS[flowId];
  if (!flow) {
    console.error(`unknown flow: ${flowId}. known flows: ${Object.keys(FLOWS).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const deps = buildSimDeps();
  let state = flow.initial(buildContext(flowId, phone, locale));
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let { state: nextState, turn } = await flow.step(state, { type: 'start' }, deps);
  state = nextState;
  console.log(`\n[${flowId}] locale=${locale} phone=${phone}`);
  printTurn(locale, turn);

  if (!turn.end) process.stdout.write('> ');
  for await (const line of rl) {
    if (turn.end) break;
    const event = parseEvent(line);
    if (event === null) {
      process.stdout.write('> ');
      continue;
    }
    ({ state: nextState, turn } = await flow.step(state, event, deps));
    state = nextState;
    printTurn(locale, turn);
    if (event.type === 'hangup' || turn.end) break;
    process.stdout.write('> ');
  }
  rl.close();
  console.log('[call ended]');
}

interface ScriptTurn {
  input: string;
  expectPromptKeys?: string[];
  expectActionTypes?: string[];
}

interface VoiceScript {
  flow: string;
  locale?: string;
  phone?: string;
  turns: ScriptTurn[];
}

function expandGlob(pattern: string): string[] {
  if (!pattern.includes('*')) return [pattern];
  const dir = dirname(pattern);
  const filePattern = basename(pattern);
  const regex = new RegExp(`^${filePattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return readdirSync(dir)
    .filter((name) => regex.test(name))
    .map((name) => join(dir, name));
}

async function runScript(path: string): Promise<boolean> {
  const doc = parseYaml(readFileSync(path, 'utf8')) as VoiceScript;
  const flow = FLOWS[doc.flow];
  if (!flow) {
    console.error(`${path}: unknown flow ${doc.flow}`);
    return false;
  }
  const locale: Locale = doc.locale && isSupportedLocale(doc.locale) ? doc.locale : 'en';
  const phone = doc.phone ?? '+919999999999';
  const deps = buildSimDeps();
  let state = flow.initial(buildContext(doc.flow, phone, locale));
  let ok = true;

  let result = await flow.step(state, { type: 'start' }, deps);
  state = result.state;

  for (const [index, step] of doc.turns.entries()) {
    const event = parseEvent(step.input);
    if (event === null) continue;
    result = await flow.step(state, event, deps);
    state = result.state;
    const { turn } = result;

    if (step.expectPromptKeys) {
      const actual = turn.prompts.map((p) => p.key);
      if (JSON.stringify(actual) !== JSON.stringify(step.expectPromptKeys)) {
        console.error(`${path} turn ${index}: prompt keys ${JSON.stringify(actual)} != expected ${JSON.stringify(step.expectPromptKeys)}`);
        ok = false;
      }
    }
    if (step.expectActionTypes) {
      const actual = turn.actions.map((a) => a.type);
      if (JSON.stringify(actual) !== JSON.stringify(step.expectActionTypes)) {
        console.error(`${path} turn ${index}: action types ${JSON.stringify(actual)} != expected ${JSON.stringify(step.expectActionTypes)}`);
        ok = false;
      }
    }
  }

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${path}`);
  return ok;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.script) {
    const paths = expandGlob(args.script);
    if (paths.length === 0) {
      console.error(`no files matched: ${args.script}`);
      process.exitCode = 1;
      return;
    }
    const results = await Promise.all(paths.map(runScript));
    process.exitCode = results.every(Boolean) ? 0 : 1;
    return;
  }

  if (!args.flow) {
    console.error('usage: voice:sim --flow <id> [--locale <code>] [--phone <phone>]');
    console.error('   or: voice:sim --script <path/*.yaml>');
    process.exitCode = 1;
    return;
  }
  const locale: Locale = args.locale && isSupportedLocale(args.locale) ? args.locale : 'en';
  await runRepl(args.flow, locale, args.phone ?? '+919999999999');
}

await main();
