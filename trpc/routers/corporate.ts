import { createTRPCRouter, corporateProcedure } from '../init';

export const corporateRouter = createTRPCRouter({
  dashboard: corporateProcedure.query(({ ctx }) => {
    const { user } = ctx.session;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      societyName: null as string | null,
      workerCount: 0,
      enrolmentCount: 0,
      welfareFundPaise: 0,
      schemes: [] as { code: string; name: string; enrolled: number }[],
    };
  }),
});
