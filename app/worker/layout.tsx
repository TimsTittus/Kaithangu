import { requireAreaSession } from '@/server/auth/area';

export default async function WorkerLayout({ children }: LayoutProps<'/worker'>) {
  await requireAreaSession(['worker'], '/worker');
  return children;
}
