import { requireAdmin } from '@/lib/auth/authorization';
import { getEnv } from '@/lib/config/env';
import { AppError, errorResponse } from '@/lib/http/errors';
import { logger } from '@/lib/observability/logger';
import { commandPresentation } from '@/lib/presentation/presentation-service';
import { verifyCsrf, verifyOrigin } from '@/lib/security/csrf';
import { presentationCommandSchema } from '@/lib/validation/presentation';

const privateHeaders = { 'Cache-Control': 'no-store, private' };

export async function POST(request: Request) {
  try {
    const { admin, session } = await requireAdmin();
    if (!verifyOrigin(request, getEnv().APP_ORIGIN)
      || !verifyCsrf(session.csrfHash, request.headers.get('x-csrf-token'))) {
      throw new AppError(
        'csrf_error',
        '요청을 확인할 수 없습니다. 새로고침 뒤 다시 시도해 주세요.',
        403,
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new AppError('invalid_json', '요청 내용을 확인해 주세요.', 400);
    }

    const command = presentationCommandSchema.parse(payload);
    const view = await commandPresentation(admin.eventId, command);
    logger.presentationCommand(command);
    return Response.json(view, { headers: privateHeaders });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('Cache-Control', privateHeaders['Cache-Control']);
    return response;
  }
}
