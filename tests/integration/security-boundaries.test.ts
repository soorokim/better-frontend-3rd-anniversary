import { describe, expect, it, vi } from 'vitest';
import { authCookiePolicy } from '@/lib/auth/cookies';
import { logger } from '@/lib/observability/logger';
import { csrfDigest, verifyCsrf, verifyOrigin } from '@/lib/security/csrf';
import { securityHeaders, sensitiveApiHeaders } from '@/lib/security/headers';
import nextConfig from '../../next.config';

const asMap = (headers: Array<{ key: string; value: string }>) =>
  new Map(headers.map(({ key, value }) => [key.toLowerCase(), value]));

describe('security boundaries', () => {
  it('sets browser isolation headers without breaking the HTTP LAN preview', () => {
    const headers = asMap(securityHeaders('http://192.168.1.155:3000'));
    const csp = headers.get('content-security-policy');

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers.has('strict-transport-security')).toBe(false);
  });

  it('adds transport enforcement only for an HTTPS deployment origin', () => {
    const headers = asMap(securityHeaders('https://anniversary.example.com'));

    expect(headers.get('content-security-policy')).toContain('upgrade-insecure-requests');
    expect(headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('marks every API response private and non-cacheable at the Next.js boundary', () => {
    expect(asMap(sensitiveApiHeaders).get('cache-control')).toBe('no-store, private');
  });

  it('wires the document and API policies into Next.js routing', async () => {
    expect(nextConfig.headers).toBeTypeOf('function');
    const routes = await nextConfig.headers!();

    expect(routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '/:path*' }),
      expect.objectContaining({ source: '/api/:path*', headers: sensitiveApiHeaders }),
    ]));
  });

  it('uses strict host cookies on HTTPS and a deliberate HTTP preview fallback', () => {
    const https = authCookiePolicy('https://anniversary.example.com');
    const secureSession = https.session('session-secret', new Date(1));
    const secureCsrf = https.csrf('csrf-secret', new Date(1));

    expect(https.names.participant).toBe('__Host-participant_session');
    expect(secureSession).toMatchObject({ secure: true, httpOnly: true, sameSite: 'strict', path: '/' });
    expect(secureCsrf).toMatchObject({ secure: true, httpOnly: false, sameSite: 'strict', path: '/' });

    const http = authCookiePolicy('http://192.168.1.155:3000');
    expect(http.names.participant).toBe('participant_session');
    expect(http.session('session-secret', new Date(1))).toMatchObject({ secure: false, httpOnly: true, sameSite: 'strict', path: '/' });
  });

  it('rejects missing or foreign origins and invalid CSRF tokens', () => {
    const allowedOrigin = 'https://anniversary.example.com';
    const trusted = new Request(`${allowedOrigin}/api/answer/current`, { headers: { origin: allowedOrigin } });
    const foreign = new Request(`${allowedOrigin}/api/answer/current`, { headers: { origin: 'https://attacker.example' } });
    const missing = new Request(`${allowedOrigin}/api/answer/current`);
    const expected = csrfDigest('expected-csrf-token');

    expect(verifyOrigin(trusted, allowedOrigin)).toBe(true);
    expect(verifyOrigin(foreign, allowedOrigin)).toBe(false);
    expect(verifyOrigin(missing, allowedOrigin)).toBe(false);
    expect(verifyCsrf(expected, 'expected-csrf-token')).toBe(true);
    expect(verifyCsrf(expected, 'different-csrf-token')).toBe(false);
    expect(verifyCsrf(expected, null)).toBe(false);
  });

  it('rejects cross-origin participant registration before processing credentials', async () => {
    const { POST: register } = await import('@/app/api/participants/register/route');
    const response = await register(new Request('http://localhost:3000/api/participants/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
      body: JSON.stringify({ inviteCode: 'do-not-process', nickname: '침입자', pin: '123456', pinConfirmation: '123456' }),
    }));

    expect(response.status).toBe(403);
  });

  it('redacts structured secrets and never copies free-form Error messages', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const secrets = {
      inviteCode: 'invite-value-never-log',
      pin: 'pin-value-never-log',
      password: 'password-value-never-log',
      resetCode: 'reset-value-never-log',
      sessionToken: 'session-value-never-log',
      privateAnswer: { content: 'answer-value-never-log' },
      error: new Error('error-message-secret-never-log'),
      participantId: 'participant-id-is-safe',
    };

    logger.info('security_test', secrets);
    const line = String(output.mock.calls[0]?.[0]);

    expect(line).toContain('participant-id-is-safe');
    expect(line).toContain('[REDACTED]');
    for (const secret of [
      secrets.inviteCode,
      secrets.pin,
      secrets.password,
      secrets.resetCode,
      secrets.sessionToken,
      secrets.privateAnswer.content,
      secrets.error.message,
    ]) expect(line).not.toContain(secret);
  });
});
