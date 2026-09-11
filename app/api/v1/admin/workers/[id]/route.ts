import type { NextRequest } from 'next/server';
import { getContextFromRequest, requireRole } from '@/server/auth/context';
import { ADMIN_ROLES } from '@/server/auth/routes';
import { handle, jsonData } from '@/server/http';
import { getWorkerService } from '@/server/services';

export const GET = handle(
  async (request, requestId, { params }: RouteContext<'/api/v1/admin/workers/[id]'>) => {
    const ctx = requireRole(
      await getContextFromRequest(request as NextRequest, requestId),
      ADMIN_ROLES,
    );
    const { id } = await params;
    return jsonData(await getWorkerService().getWorker(ctx, id));
  },
);
