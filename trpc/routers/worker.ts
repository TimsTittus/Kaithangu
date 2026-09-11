import { createTRPCRouter, workerProcedure } from '../init';

export const workerRouter = createTRPCRouter({
  dashboard: workerProcedure.query(({ ctx }) => {
    const { user } = ctx.session;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      available: true,
      earningsPaise: 1_845_000,
      welfarePaise: 184_500,
      jobsDone: 24,
      rating: 4.9,
      acceptancePct: 100,
    };
  }),
});
