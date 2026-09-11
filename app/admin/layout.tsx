import { requireAreaSession } from '@/server/auth/area';
import { ADMIN_ROLES } from '@/server/auth/routes';

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await requireAreaSession(ADMIN_ROLES, '/admin');
  return children;
}
