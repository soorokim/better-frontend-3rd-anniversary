import { describe, expect, it } from 'vitest';
import { authCookiePolicy } from '@/lib/auth/cookies';

describe('auth cookie policy', () => {
  it('uses host-prefixed secure cookies on HTTPS', () => {
    const policy = authCookiePolicy('https://anniversary.example.com');

    expect(policy.names).toEqual({
      participant: '__Host-participant_session',
      participantCsrf: '__Host-participant_csrf',
      admin: '__Host-admin_session',
    });
    expect(policy.session('token', new Date(1)).secure).toBe(true);
    expect(policy.csrf('token', new Date(1))).toMatchObject({ secure: true, httpOnly: false, path: '/' });
  });

  it('uses unprefixed non-secure cookies on HTTP', () => {
    const policy = authCookiePolicy('http://192.168.1.155:3000');

    expect(policy.names).toEqual({
      participant: 'participant_session',
      participantCsrf: 'participant_csrf',
      admin: 'admin_session',
    });
    expect(policy.session('token', new Date(1)).secure).toBe(false);
    expect(policy.expired(false)).toMatchObject({ secure: false, httpOnly: false, path: '/' });
  });
});
