// Next.js calls register() once when a server instance starts. Validating the
// environment here makes a misconfigured server exit immediately with a list
// of the missing variables instead of failing on the first request.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
