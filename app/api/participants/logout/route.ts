import { NextResponse } from 'next/server';
import { requireParticipant } from '@/lib/auth/authorization';
import { expiredCookie, PARTICIPANT_COOKIE, PARTICIPANT_CSRF_COOKIE } from '@/lib/auth/cookies';
import { revokeSession } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';
import { AppError, errorResponse } from '@/lib/http/errors';
import { verifyCsrf, verifyOrigin } from '@/lib/security/csrf';

export async function POST(request: Request) {
  try {
    const { session, token } = await requireParticipant();
    if (!verifyOrigin(request, getEnv().APP_ORIGIN)
      || !verifyCsrf(session.csrfHash, request.headers.get('x-csrf-token'))) throw new AppError('csrf_error', '요청을 확인할 수 없습니다. 새로고침 뒤 다시 시도해 주세요.', 403);
    await revokeSession('participant', token);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(PARTICIPANT_COOKIE, '', expiredCookie);
    response.cookies.set(PARTICIPANT_CSRF_COOKIE, '', { ...expiredCookie, httpOnly: false });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
