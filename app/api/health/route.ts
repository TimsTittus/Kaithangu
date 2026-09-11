import packageJson from '../../../package.json';
import { client } from '@/db';
import { redis } from '@/lib/redis';
import { checkHealth } from '@/lib/health';

export async function GET(): Promise<Response> {
  const report = await checkHealth({
    version: packageJson.version,
    checkDb: () => client`SELECT 1`,
    checkRedis: () => redis.ping(),
  });
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
