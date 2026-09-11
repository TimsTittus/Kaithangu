import { requireAreaSession } from '@/server/auth/area';

export default async function CorporateLayout({ children }: LayoutProps<'/corporate'>) {
  await requireAreaSession(['corporate'], '/corporate');
  return children;
}
