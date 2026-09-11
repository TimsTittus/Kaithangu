import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/landing/LandingPage';
import { getSession } from '@/server/auth/context';
import { ROLE_HOME } from '@/server/auth/routes';

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_HOME[session.user.role]);
  }
  return <LandingPage />;
}
