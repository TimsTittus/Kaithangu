import { randomUUID } from 'node:crypto';
import { initTRPC } from '@trpc/server';

export interface TrpcContext {
  requestId: string;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function createTrpcContext({ req }: { req: Request }): TrpcContext {
  const incoming = req.headers.get('x-request-id');
  return {
    requestId: incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID(),
  };
}

const t = initTRPC.context<TrpcContext>().create({
  // Every error carries the requestId so clients can quote it; the full error
  // stays in server logs. AppError → messageKey mapping arrives with AppError.
  errorFormatter({ shape, ctx }) {
    return { ...shape, data: { ...shape.data, requestId: ctx?.requestId } };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
