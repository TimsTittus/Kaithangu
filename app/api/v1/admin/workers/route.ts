import type { NextRequest } from 'next/server';
import { getContextFromRequest, requireRole } from '@/server/auth/context';
import { ADMIN_ROLES } from '@/server/auth/routes';
import { handle, jsonData } from '@/server/http';
import { getWorkerService } from '@/server/services';

export const GET = handle(async (request, requestId) => {
  const ctx = requireRole(
    await getContextFromRequest(request as NextRequest, requestId),
    ADMIN_ROLES,
  );
  const filters = Object.fromEntries(new URL(request.url).searchParams);
  return jsonData(await getWorkerService().listWorkers(ctx, filters));
});
