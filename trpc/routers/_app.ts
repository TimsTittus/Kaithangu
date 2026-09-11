import { createTRPCRouter, publicProcedure } from '../init';

export const appRouter = createTRPCRouter({
  system: createTRPCRouter({
    ping: publicProcedure.query(() => ({ ok: true })),
  }),
});

export type AppRouter = typeof appRouter;
