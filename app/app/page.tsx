import { redirect } from 'next/navigation';
import { ROLE_HOME } from '@/server/auth/routes';
import { trpc } from '@/trpc/server';

/** Signed-in users land here and are sent to their role portal. */
export default async function AppDispatch() {
  const me = await trpc.session.me();
  redirect(me.homePath ?? ROLE_HOME[me.role]);
}
