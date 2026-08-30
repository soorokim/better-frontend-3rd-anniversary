import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export const PARTICIPANT_COOKIE = '__Host-participant_session';
export const PARTICIPANT_CSRF_COOKIE = '__Host-participant_csrf';
export const ADMIN_COOKIE = '__Host-admin_session';

export function sessionCookie(value: string, expires: Date): Partial<ResponseCookie> & { value: string } {
  return { value, expires, httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
}

export const expiredCookie: Partial<ResponseCookie> & { value: string } = {
  value: '', expires: new Date(0), httpOnly: true, secure: true, sameSite: 'lax', path: '/',
};

export function csrfCookie(value: string, expires: Date): Partial<ResponseCookie> & { value: string } {
  return { value, expires, httpOnly: false, secure: true, sameSite: 'lax', path: '/' };
}
