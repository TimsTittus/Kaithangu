import { requireAreaSession } from '@/server/auth/area';

export default async function InstitutionLayout({ children }: LayoutProps<'/org'>) {
  await requireAreaSession(['institution_admin'], '/org');
  return children;
}
