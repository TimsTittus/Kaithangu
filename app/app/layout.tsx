import { ROLES } from '@/lib/core';
import { requireAreaSession } from '@/server/auth/area';

export default async function AppDispatchLayout({ children }: LayoutProps<'/app'>) {
  await requireAreaSession(ROLES, '/app');
  return children;
}
