import { NextResponse } from 'next/server';
import { csrfCookie, PARTICIPANT_COOKIE, PARTICIPANT_CSRF_COOKIE, sessionCookie } from '@/lib/auth/cookies';
import { registerParticipant } from '@/lib/auth/participant-service';
import { errorResponse } from '@/lib/http/errors';
import { clientIp } from '@/lib/http/request';
import { registerSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const result = await registerParticipant({ ...input, ipAddress: clientIp(request) });
    const response = NextResponse.json(result.view, { status: 201 });
    response.cookies.set(PARTICIPANT_COOKIE, result.session.token, sessionCookie(result.session.token, result.session.expiresAt));
    response.cookies.set(PARTICIPANT_CSRF_COOKIE, result.session.csrfToken, csrfCookie(result.session.csrfToken, result.session.expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
