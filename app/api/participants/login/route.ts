import { NextResponse } from 'next/server';
import { authCookiePolicy } from '@/lib/auth/cookies';
import { loginParticipant } from '@/lib/auth/participant-service';
import { errorResponse } from '@/lib/http/errors';
import { clientIp } from '@/lib/http/request';
import { loginSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const result = await loginParticipant({ ...input, ipAddress: clientIp(request) });
    const response = NextResponse.json(result.view);
    const cookies = authCookiePolicy();
    response.cookies.set(cookies.names.participant, result.session.token, cookies.session(result.session.token, result.session.expiresAt));
    response.cookies.set(cookies.names.participantCsrf, result.session.csrfToken, cookies.csrf(result.session.csrfToken, result.session.expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
