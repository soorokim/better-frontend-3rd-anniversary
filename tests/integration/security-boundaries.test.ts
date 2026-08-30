import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authCookiePolicy } from '@/lib/auth/cookies';
import { logger } from '@/lib/observability/logger';
import { csrfDigest, verifyCsrf, verifyOrigin } from '@/lib/security/csrf';
import { securityHeaders, sensitiveApiHeaders } from '@/lib/security/headers';
import nextConfig from '../../next.config';

const presenterBoundary = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getPresentationController: vi.fn(),
  getPresentationScreen: vi.fn(),
  commandPresentation: vi.fn(),
}));

vi.mock('@/lib/auth/authorization', () => ({
  requireAdmin: presenterBoundary.requireAdmin,
}));

vi.mock('@/lib/presentation/presentation-service', () => ({
  getPresentationController: presenterBoundary.getPresentationController,
  getPresentationScreen: presenterBoundary.getPresentationScreen,
  commandPresentation: presenterBoundary.commandPresentation,
}));

const presenterAdmin = {
  admin: { eventId: 'event-presenter-security' },
  session: { csrfHash: csrfDigest('presenter-csrf-token') },
  token: 'admin-session-token-never-log',
};

const controllerView = {
  question: { id: 'question-id', prompt: '3주년을 맞은 지금 어떤 마음인가요?' },
  summary: { total: 1, submitted: 1, notSubmitted: 0 },
  session: {
    revision: 0,
    currentItemId: null,
    authorRevealed: false,
    allPresented: false,
    updatedAt: null,
  },
  currentSlide: null,
  answers: [],
};

const screenView = {
  question: controllerView.question,
  revision: 0,
  updatedAt: null,
  slide: { kind: 'waiting' as const },
};

const asMap = (headers: Array<{ key: string; value: string }>) =>
  new Map(headers.map(({ key, value }) => [key.toLowerCase(), value]));

describe('security boundaries', () => {
  beforeEach(() => {
    presenterBoundary.requireAdmin.mockReset();
    presenterBoundary.getPresentationController.mockReset();
    presenterBoundary.getPresentationScreen.mockReset();
    presenterBoundary.commandPresentation.mockReset();
    presenterBoundary.requireAdmin.mockResolvedValue(presenterAdmin);
    presenterBoundary.getPresentationController.mockResolvedValue(controllerView);
    presenterBoundary.getPresentationScreen.mockResolvedValue(screenView);
    presenterBoundary.commandPresentation.mockResolvedValue(controllerView);
  });

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

  it('keeps presenter controller and projector responses private on success', async () => {
    const { GET: getController } = await import('@/app/api/admin/presentation/route');
    const { GET: getScreen } = await import('@/app/api/admin/presentation/screen/route');

    const controllerResponse = await getController();
    const screenResponse = await getScreen();

    expect(controllerResponse.status).toBe(200);
    expect(controllerResponse.headers.get('cache-control')).toBe('no-store, private');
    expect(screenResponse.status).toBe(200);
    expect(screenResponse.headers.get('cache-control')).toBe('no-store, private');
    expect(presenterBoundary.getPresentationController).toHaveBeenCalledWith(presenterAdmin.admin.eventId);
    expect(presenterBoundary.getPresentationScreen).toHaveBeenCalledWith(presenterAdmin.admin.eventId);
  });

  it('rejects unauthenticated presenter reads without calling result services or caching errors', async () => {
    presenterBoundary.requireAdmin.mockRejectedValueOnce(
      new (await import('@/lib/http/errors')).UnauthorizedError(),
    );
    const { GET: getController } = await import('@/app/api/admin/presentation/route');
    const controllerResponse = await getController();

    presenterBoundary.requireAdmin.mockRejectedValueOnce(
      new (await import('@/lib/http/errors')).UnauthorizedError(),
    );
    const { GET: getScreen } = await import('@/app/api/admin/presentation/screen/route');
    const screenResponse = await getScreen();

    expect(controllerResponse.status).toBe(401);
    expect(controllerResponse.headers.get('cache-control')).toBe('no-store, private');
    expect(screenResponse.status).toBe(401);
    expect(screenResponse.headers.get('cache-control')).toBe('no-store, private');
    expect(presenterBoundary.getPresentationController).not.toHaveBeenCalled();
    expect(presenterBoundary.getPresentationScreen).not.toHaveBeenCalled();
  });

  it.each([
    ['missing Origin', {}, 'presenter-csrf-token'],
    ['foreign Origin', { origin: 'https://attacker.example' }, 'presenter-csrf-token'],
    ['missing CSRF', { origin: 'http://localhost:3000' }, undefined],
    ['invalid CSRF', { origin: 'http://localhost:3000' }, 'wrong-presenter-csrf-token'],
  ])('rejects presenter commands with %s before applying state', async (_case, originHeaders, csrf) => {
    const { POST } = await import('@/app/api/admin/presentation/commands/route');
    const response = await POST(new Request('http://localhost:3000/api/admin/presentation/commands', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...originHeaders,
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      body: JSON.stringify({ type: 'select_random' }),
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store, private');
    expect(await response.json()).toMatchObject({ error: { code: 'csrf_error' } });
    expect(presenterBoundary.commandPresentation).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated presenter command before checking or changing state', async () => {
    presenterBoundary.requireAdmin.mockRejectedValueOnce(
      new (await import('@/lib/http/errors')).UnauthorizedError(),
    );
    const { POST } = await import('@/app/api/admin/presentation/commands/route');
    const response = await POST(new Request('http://localhost:3000/api/admin/presentation/commands', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-csrf-token': 'presenter-csrf-token',
      },
      body: JSON.stringify({ type: 'select_random' }),
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store, private');
    expect(presenterBoundary.commandPresentation).not.toHaveBeenCalled();
  });

  it('authenticates and validates a presenter command before applying it', async () => {
    const { POST } = await import('@/app/api/admin/presentation/commands/route');
    const response = await POST(new Request('http://localhost:3000/api/admin/presentation/commands', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-csrf-token': 'presenter-csrf-token',
      },
      body: JSON.stringify({ type: 'select_random' }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, private');
    expect(presenterBoundary.commandPresentation).toHaveBeenCalledWith(
      presenterAdmin.admin.eventId,
      { type: 'select_random' },
    );
  });

  it('does not reflect invalid presenter payload secrets in responses or logs', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const secret = 'private-presenter-snapshot-never-reflect';
    const { POST } = await import('@/app/api/admin/presentation/commands/route');
    const response = await POST(new Request('http://localhost:3000/api/admin/presentation/commands', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-csrf-token': 'presenter-csrf-token',
      },
      body: JSON.stringify({ type: 'select_random', snapshot: secret }),
    }));
    const body = JSON.stringify(await response.json());
    const logs = [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls].flat().join('\n');

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store, private');
    expect(body).not.toContain(secret);
    expect(logs).not.toContain(secret);
    expect(presenterBoundary.commandPresentation).not.toHaveBeenCalled();
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
      snapshot: 'snapshot-value-never-log',
      nicknameSnapshot: 'nickname-value-never-log',
      author: { nickname: 'author-value-never-log' },
      avatar: { traits: { accessory: 'avatar-value-never-log' } },
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
      secrets.snapshot,
      secrets.nicknameSnapshot,
      secrets.author.nickname,
      secrets.avatar.traits.accessory,
      secrets.error.message,
    ]) expect(line).not.toContain(secret);
  });
});
