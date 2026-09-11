import { z } from 'zod';
import { getCorporateService } from '@/server/services';
import { corporateProcedure, createTRPCRouter } from '../init';

export const corporateRouter = createTRPCRouter({
  dashboard: corporateProcedure.query(async ({ ctx }) => {
    return getCorporateService().getDashboard(ctx.requestCtx);
  }),

  profile: corporateProcedure.query(async ({ ctx }) => {
    return getCorporateService().getProfile(ctx.requestCtx);
  }),

  workers: corporateProcedure
    .input(
      z
        .object({
          status: z.enum(['pending', 'verified', 'suspended']).optional(),
          tradeCode: z.string().optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return getCorporateService().listWorkers(ctx.requestCtx, input);
    }),

  bookings: corporateProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return getCorporateService().listBookings(ctx.requestCtx, input);
    }),

  verifyWorker: corporateProcedure
    .input(
      z.object({
        workerId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return getCorporateService().verifyWorker(ctx.requestCtx, input);
    }),

  revokeWorker: corporateProcedure
    .input(
      z.object({
        workerId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return getCorporateService().revokeVerification(ctx.requestCtx, input);
    }),
});
