import { publicProcedure, router } from '../init';

export const appRouter = router({
  system: router({
    ping: publicProcedure.query(({ ctx }) => ({ ok: true, requestId: ctx.requestId })),
  }),
});

export type AppRouter = typeof appRouter;
