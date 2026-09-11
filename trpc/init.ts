import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';
import superjson from 'superjson';
import { isAppError, requireRole, ROLES, type Role } from '@/lib/core';
import { db } from '@/db';
import { redis } from '@/lib/redis';
import { getSession } from '@/server/auth/context';

export const createTRPCContext = cache(async () => {
  const session = await getSession();
  return { db, redis, session };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

function mapAuthError(error: unknown): never {
  if (isAppError(error) && error.code === 'UNAUTHENTICATED') {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: error.messageKey });
  }
  if (isAppError(error) && error.code === 'FORBIDDEN') {
    throw new TRPCError({ code: 'FORBIDDEN', message: error.messageKey });
  }
  throw error;
}

function roleMiddleware<R extends Role>(roles: readonly R[]) {
  return t.middleware(({ ctx, next }) => {
    try {
      const requestCtx = requireRole(ctx.session?.ctx ?? null, roles);
      return next({
        ctx: {
          ...ctx,
          session: ctx.session!,
          requestCtx,
        },
      });
    } catch (error) {
      mapAuthError(error);
    }
  });
}

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(roleMiddleware(ROLES));
export const userProcedure = t.procedure.use(roleMiddleware(['user']));
export const workerProcedure = t.procedure.use(roleMiddleware(['worker']));
export const corporateProcedure = t.procedure.use(roleMiddleware(['corporate']));
