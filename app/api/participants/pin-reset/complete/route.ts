import { completePinReset } from '@/lib/auth/pin-reset-service';
import { AppError, errorResponse } from '@/lib/http/errors';
import { getEnv } from '@/lib/config/env';
import { verifyOrigin } from '@/lib/security/csrf';
import { clientIp } from '@/lib/http/request';
import { completePinResetSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  try {
    if (!verifyOrigin(request, getEnv().APP_ORIGIN)) throw new AppError('csrf_error', '요청을 확인할 수 없습니다. 새로고침 뒤 다시 시도해 주세요.', 403);
    const input = completePinResetSchema.parse(await request.json()); await completePinReset({ inviteCode: input.inviteCode, nickname: input.nickname, resetCode: input.resetCode, newPin: input.newPin, ipAddress: clientIp(request) });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { const response = errorResponse(error); response.headers.set('Cache-Control', 'no-store'); return response; }
}
