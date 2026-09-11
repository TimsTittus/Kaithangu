import { HomeScreen } from '@/components/HomeScreen';
import { trpc } from '@/trpc/server';

export default async function WorkerHome() {
  const dashboard = await trpc.worker.dashboard();
  return (
    <HomeScreen
      kind="worker"
      stats={{
        earningsPaise: dashboard.earningsPaise,
        welfarePaise: dashboard.welfarePaise,
        jobsDone: dashboard.jobsDone,
        rating: dashboard.rating,
        acceptancePct: dashboard.acceptancePct,
      }}
    />
  );
}
