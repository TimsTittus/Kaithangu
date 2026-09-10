/**
 * First-load JS budget (AGENTS.md 7): parses the Next.js build output
 * (apps/web/.next/diagnostics/route-bundle-stats.json, written by `next build`)
 * and fails when any /app or /w route loads more than 150 KB of gzipped JS.
 *
 *   bun run build && bun run bundle:check
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';

const WEB_DIR = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const STATS = `${WEB_DIR}.next/diagnostics/route-bundle-stats.json`;
const BUDGET_BYTES = 150 * 1024;
const BUDGETED = /^\/(app|w)(\/|$)/;

const stats = z.array(z.object({ route: z.string(), firstLoadChunkPaths: z.array(z.string()) }));

if (!existsSync(STATS)) {
  console.error(`${STATS} not found. Run \`bun run build\` first.`);
  process.exit(1);
}

const gzipped = new Map<string, number>();
function gzipSize(path: string): number {
  let size = gzipped.get(path);
  if (size === undefined) {
    size = gzipSync(readFileSync(`${WEB_DIR}${path}`), { level: 9 }).length;
    gzipped.set(path, size);
  }
  return size;
}

let failed = false;
const routes = stats
  .parse(JSON.parse(readFileSync(STATS, 'utf8')))
  .filter(({ route }) => BUDGETED.test(route))
  .sort((a, b) => a.route.localeCompare(b.route));
if (routes.length === 0) {
  console.error('no /app or /w routes in the build output');
  process.exit(1);
}
for (const { route, firstLoadChunkPaths } of routes) {
  const total = [...new Set(firstLoadChunkPaths)].reduce((sum, path) => sum + gzipSize(path), 0);
  const over = total > BUDGET_BYTES;
  failed ||= over;
  console.log(
    `${over ? 'FAIL' : 'ok  '} ${route.padEnd(24)} ${(total / 1024).toFixed(1).padStart(6)} KB gzip`,
  );
}
console.log(`budget: ${BUDGET_BYTES / 1024} KB gzipped first-load JS per route`);
if (failed) process.exit(1);
