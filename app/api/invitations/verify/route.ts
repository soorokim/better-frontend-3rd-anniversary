import { getEnv } from '@/lib/config/env';
import { verifyParticipantInvitation } from '@/lib/auth/participant-service';
import { AppError, errorResponse } from '@/lib/http/errors';
import { clientIp } from '@/lib/http/request';
import { verifyOrigin } from '@/lib/security/csrf';
import { invitationSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  try {
    if (!verifyOrigin(request, getEnv().APP_ORIGIN)) {
      throw new AppError('csrf_error', '요청을 확인할 수 없습니다. 새로고침 뒤 다시 시도해 주세요.', 403);
    }
    const input = invitationSchema.parse(await request.json());
    return Response.json(await verifyParticipantInvitation({ ...input, ipAddress: clientIp(request) }));
  } catch (error) {
    return errorResponse(error);
  }
}
