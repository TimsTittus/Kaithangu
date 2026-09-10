export type ProbeStatus = 'up' | 'down';

export const HEALTH_PROBE_TIMEOUT_MS = 1000;

/**
 * Run a connectivity check with a hard timeout. Any failure — rejection,
 * synchronous throw, or no answer within `timeoutMs` — reports 'down'.
 */
export async function probe(
  check: () => PromiseLike<unknown>,
  timeoutMs: number,
): Promise<ProbeStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<ProbeStatus>((resolve) => {
    timer = setTimeout(() => resolve('down'), timeoutMs);
  });
  const result = Promise.resolve()
    .then(check)
    .then(
      (): ProbeStatus => 'up',
      (): ProbeStatus => 'down',
    );
  try {
    return await Promise.race([result, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

export interface HealthReport {
  ok: boolean;
  version: string;
  db: ProbeStatus;
  redis: ProbeStatus;
}

export interface HealthDeps {
  version: string;
  checkDb: () => PromiseLike<unknown>;
  checkRedis: () => PromiseLike<unknown>;
  timeoutMs?: number;
}

export async function checkHealth({
  version,
  checkDb,
  checkRedis,
  timeoutMs = HEALTH_PROBE_TIMEOUT_MS,
}: HealthDeps): Promise<HealthReport> {
  const [db, redis] = await Promise.all([probe(checkDb, timeoutMs), probe(checkRedis, timeoutMs)]);
  return { ok: db === 'up' && redis === 'up', version, db, redis };
}
