import packageJson from '../../../../package.json';
import { getRedis, getSql } from '@/lib/datastores';
import { checkHealth } from '@/lib/health';

export async function GET(): Promise<Response> {
  const report = await checkHealth({
    version: packageJson.version,
    checkDb: () => getSql()`SELECT 1`,
    checkRedis: () => getRedis().ping(),
  });
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
