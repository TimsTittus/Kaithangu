import { requireAreaSession } from '@/server/auth/area';

export default async function WorkerLayout({ children }: LayoutProps<'/w'>) {
  await requireAreaSession(['worker'], '/w');
  return children;
}
