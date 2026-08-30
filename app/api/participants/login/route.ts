import { NextResponse } from 'next/server';
import { csrfCookie, PARTICIPANT_COOKIE, PARTICIPANT_CSRF_COOKIE, sessionCookie } from '@/lib/auth/cookies';
import { loginParticipant } from '@/lib/auth/participant-service';
import { errorResponse } from '@/lib/http/errors';
import { clientIp } from '@/lib/http/request';
import { loginSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const result = await loginParticipant({ ...input, ipAddress: clientIp(request) });
    const response = NextResponse.json(result.view);
    response.cookies.set(PARTICIPANT_COOKIE, result.session.token, sessionCookie(result.session.token, result.session.expiresAt));
    response.cookies.set(PARTICIPANT_CSRF_COOKIE, result.session.csrfToken, csrfCookie(result.session.csrfToken, result.session.expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
