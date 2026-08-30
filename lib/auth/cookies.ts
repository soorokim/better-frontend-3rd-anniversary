import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { getEnv } from '@/lib/config/env';
import { authCookieNames } from './cookie-names';

type CookieValue = Partial<ResponseCookie> & { value: string };

export function authCookiePolicy(origin = getEnv().APP_ORIGIN) {
  const secure = new URL(origin).protocol === 'https:';
  const base = { secure, sameSite: 'strict' as const, path: '/' };

  return {
    names: authCookieNames(secure),
    session(value: string, expires: Date): CookieValue {
      return { ...base, value, expires, httpOnly: true };
    },
    csrf(value: string, expires: Date): CookieValue {
      return { ...base, value, expires, httpOnly: false };
    },
    expired(httpOnly = true): CookieValue {
      return { ...base, value: '', expires: new Date(0), httpOnly };
    },
  };
}
