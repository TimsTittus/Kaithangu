import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/context';
import { ROLE_HOME } from '@/server/auth/routes';

export default async function Home() {
  const session = await getSession();
  redirect(session ? ROLE_HOME[session.user.role] : '/login');
}
