import { NextResponse } from 'next/server';
import { authCookiePolicy } from '@/lib/auth/cookies';
import { registerParticipant } from '@/lib/auth/participant-service';
import { errorResponse } from '@/lib/http/errors';
import { clientIp } from '@/lib/http/request';
import { registerSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  try {
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
