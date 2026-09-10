/**
 * Lighthouse CI for /app and /app/book/plumber (bun run lhci): mobile
 * emulation with simulated throttling against a production build. /app needs
 * a signed-in customer, so this prepares the test database (same fixture as
 * e2e), signs a session for the fixture customer and passes it as a Cookie
 * header. Thresholds live in lighthouserc.json; the scores are printed.
 *
 *   bun run lhci                 (SKIP_BUILD=1 reuses an existing .next build)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SESSION_COOKIE } from '@kaithangu/core';
import { chromium } from '@playwright/test';
import { loadTestEnv } from '../src/test/env';
import {
  createAuthFixture,
  deleteAuthFixture,
  ensureTestPincode,
  openTestDb,
  prepareTestDatabase,
  sessionToken,
} from '../src/test/fixtures';

const WEB_DIR = fileURLToPath(new URL('../', import.meta.url));
const REPORT_DIR = `${WEB_DIR}.lighthouseci/reports`;

function run(command: string, args: string[], env: NodeJS.ProcessEnv): number {
  const result = spawnSync(command, args, { cwd: WEB_DIR, env, stdio: 'inherit' });
  return result.status ?? 1;
}

interface ManifestEntry {
  url: string;
  isRepresentativeRun: boolean;
  summary: Record<string, number>;
}

function printScores(): void {
  const manifestPath = `${REPORT_DIR}/manifest.json`;
  if (!existsSync(manifestPath)) {
    console.log(`no Lighthouse manifest in ${REPORT_DIR}`);
    return;
  }
  const entries = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestEntry[];
  console.log('\nLighthouse scores (mobile):');
  for (const entry of entries.filter((e) => e.isRepresentativeRun)) {
    const scores = ['performance', 'accessibility', 'best-practices']
      .map((key) => `${key} ${Math.round((entry.summary[key] ?? 0) * 100)}`)
      .join(' · ');
    console.log(`  ${new URL(entry.url).pathname}: ${scores}`);
  }
}

async function main(): Promise<number> {
  loadTestEnv();
  const url = await prepareTestDatabase();
  const { db, client } = openTestDb(url);
  const fixture = await createAuthFixture(db, { consented: true });
  await ensureTestPincode(db);
  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
      CHROME_PATH: chromium.executablePath(),
    };
    if (process.env.SKIP_BUILD !== '1' && run('bunx', ['next', 'build'], env) !== 0) return 1;

    const cookie = `${SESSION_COOKIE}=${await sessionToken(fixture.users.customer)}; NEXT_LOCALE=ml`;
    if (existsSync(REPORT_DIR)) {
      for (const name of readdirSync(REPORT_DIR))
        rmSync(`${REPORT_DIR}/${name}`, { recursive: true });
    }
    const status = run(
      'bunx',
      ['lhci', 'autorun', `--collect.settings.extraHeaders=${JSON.stringify({ Cookie: cookie })}`],
      env,
    );
    printScores();
    return status;
  } finally {
    await deleteAuthFixture(db, fixture);
    await client.end({ timeout: 5 });
  }
}

main().then(
  (status) => process.exit(status),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
