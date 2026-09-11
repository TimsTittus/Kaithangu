import { initTRPC } from '@trpc/server';
import { cache } from 'react';
import superjson from 'superjson';
import { db } from '@/db';
import { redis } from '@/lib/redis';

export const createTRPCContext = cache(async () => {
  return { db, redis };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;
