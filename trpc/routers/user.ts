import { createTRPCRouter, userProcedure } from '../init';

export const userRouter = createTRPCRouter({
  dashboard: userProcedure.query(({ ctx }) => {
    const { user } = ctx.session;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      servicesPaise: 582_040,
      expensesPaise: 234_020,
      transactionCount: 28,
      welfarePaise: 320_000,
    };
  }),
});
