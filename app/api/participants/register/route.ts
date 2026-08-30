import { NextResponse } from 'next/server';
import { authCookiePolicy } from '@/lib/auth/cookies';
import { registerParticipant } from '@/lib/auth/participant-service';
import { AppError, errorResponse } from '@/lib/http/errors';
import { clientIp } from '@/lib/http/request';
import { registerSchema } from '@/lib/validation/auth';
import { getEnv } from '@/lib/config/env';
import { verifyOrigin } from '@/lib/security/csrf';

export async function POST(request: Request) {
  try {
    if (!verifyOrigin(request, getEnv().APP_ORIGIN)) throw new AppError('csrf_error', '요청을 확인할 수 없습니다. 새로고침 뒤 다시 시도해 주세요.', 403);
    const input = registerSchema.parse(await request.json());
    const result = await registerParticipant({ ...input, ipAddress: clientIp(request) });
    const response = NextResponse.json(result.view, { status: 201 });
    const cookies = authCookiePolicy();
    response.cookies.set(cookies.names.participant, result.session.token, cookies.session(result.session.token, result.session.expiresAt));
    response.cookies.set(cookies.names.participantCsrf, result.session.csrfToken, cookies.csrf(result.session.csrfToken, result.session.expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
