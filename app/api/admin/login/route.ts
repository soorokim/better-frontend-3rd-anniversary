import { NextResponse } from 'next/server';
import { loginAdmin } from '@/lib/auth/admin-service';
import { authCookiePolicy } from '@/lib/auth/cookies';
import { AppError, errorResponse } from '@/lib/http/errors';
import { clientIp } from '@/lib/http/request';
import { getEnv } from '@/lib/config/env';
import { verifyOrigin } from '@/lib/security/csrf';
import { adminLoginSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  try {
    if (!verifyOrigin(request, getEnv().APP_ORIGIN)) throw new AppError('csrf_error', '요청을 확인할 수 없습니다. 새로고침 뒤 다시 시도해 주세요.', 403);
    const input = adminLoginSchema.parse(await request.json()); const result = await loginAdmin({ ...input, ipAddress: clientIp(request) });
    const response = NextResponse.json({ authenticated: true }, { headers: { 'Cache-Control': 'no-store' } }); const policy = authCookiePolicy();
    response.cookies.set(policy.names.admin, result.session.token, policy.session(result.session.token, result.session.expiresAt));
    response.cookies.set(policy.names.adminCsrf, result.session.csrfToken, policy.csrf(result.session.csrfToken, result.session.expiresAt));
    return response;
  } catch (error) { return errorResponse(error); }
}
