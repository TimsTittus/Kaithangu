import { AppError, isSttMimeType, MAX_STT_BYTES } from '@kaithangu/core';
import type { NextRequest } from 'next/server';
import { getContextFromRequest } from '@/server/auth/context';
import { handle, jsonData, readLimitedBody } from '@/server/http';
import { getSpeechService } from '@/server/services';

/**
 * Speech-to-text for the booking problem box: the raw recording as the body
 * (audio/webm or audio/ogg, at most 1 MB). Signed-in users only.
 */
export const POST = handle(async (request, requestId) => {
  const ctx = await getContextFromRequest(request as NextRequest, requestId);
  if (ctx === null) throw new AppError('UNAUTHENTICATED');
  const mimeType = request.headers.get('content-type') ?? '';
  // Checked before reading the body; the service re-checks both.
  if (!isSttMimeType(mimeType)) throw new AppError('UNSUPPORTED_MEDIA');
  const audio = await readLimitedBody(request, MAX_STT_BYTES);
  return jsonData(await getSpeechService().transcribe(ctx, { audio, mimeType }));
});
