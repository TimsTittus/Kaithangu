import { ROLE_HOME } from '@/server/auth/routes';
import { createTRPCRouter, protectedProcedure } from '../init';

export const sessionRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => {
    const { user } = ctx.session;
    return {
      id: user.id,
      role: user.role,
      name: user.name,
      homePath: ROLE_HOME[user.role],
    };
  }),
});
