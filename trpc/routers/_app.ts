import { createTRPCRouter, publicProcedure } from '../init';
import { corporateRouter } from './corporate';
import { sessionRouter } from './session';
import { userRouter } from './user';
import { workerRouter } from './worker';

export const appRouter = createTRPCRouter({
  system: createTRPCRouter({
    ping: publicProcedure.query(() => ({ ok: true })),
  }),
  session: sessionRouter,
  user: userRouter,
  worker: workerRouter,
  corporate: corporateRouter,
});

export type AppRouter = typeof appRouter;
