import { requireAreaSession } from '@/server/auth/area';

export default async function CustomerLayout({ children }: LayoutProps<'/app'>) {
  await requireAreaSession(['customer'], '/app');
  return children;
}
