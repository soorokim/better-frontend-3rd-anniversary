import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { authThrottles, events, participantSessions, participants } from '@/db/schema';
import { authCookieNames } from '@/lib/auth/cookie-names';
import { createTestDatabase } from '@/tests/helpers/database';
import { eventFactory, participantFactory } from '@/tests/helpers/factories';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';
import { hashSecret } from '@/lib/security/crypto';
import { throttleSubject } from '@/lib/security/rate-limit';
import { normalizeNickname } from '@/lib/validation/nickname';

vi.mock('@/lib/security/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security/crypto')>();
  return { ...actual, hashSecret: vi.fn(actual.hashSecret) };
});

let currentToken: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => currentToken ? { value: currentToken } : undefined }) }));

const registration = (inviteCode = 'test-invite-code-1234', nickname = '보안', ipAddress = '127.0.0.20') => new Request('http://localhost:3000/api/participants/register', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': ipAddress },
  body: JSON.stringify({ inviteCode, nickname, pin: '123456', pinConfirmation: '123456' }),
});

describe('participant authentication security', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let eventId: string;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => {
    await database.reset();
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    eventId = event.id;
    await conversationProfileBatchFactory(database.db, event.id, [
      { nickname: 'Player' },
      { nickname: '보안', aliases: ['교차로그인'] },
    ]);
    vi.mocked(hashSecret).mockClear();
    currentToken = undefined;
  });
  afterAll(async () => database?.close());

  it('rejects a bad invite without creating a participant and throttles repeated attempts', async () => {
    const { POST } = await import('@/app/api/participants/register/route');
    const statuses = [];
    for (let index = 0; index < 4; index += 1) statuses.push((await POST(registration('wrong-invite-code-0000'))).status);
    expect(statuses.slice(0, 2)).toEqual([401, 401]);
    expect(statuses[2]).toBe(429);
    expect(statuses[3]).toBe(429);
    expect(await database.db.select().from(participants)).toHaveLength(0);
  });

  it('does not overwrite a normalized nickname collision', async () => {
    const { POST } = await import('@/app/api/participants/register/route');
    expect((await POST(registration(undefined, ' Player '))).status).toBe(201);
    const duplicate = await POST(registration(undefined, 'player'));
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.code).toBe('nickname_taken');
    expect(await database.db.select().from(participants)).toHaveLength(1);
  });

  it('returns a generic PIN error, then rejects an expired session', async () => {
    const { POST: register } = await import('@/app/api/participants/register/route');
    const registered = await register(registration());
    const { POST: login } = await import('@/app/api/participants/login/route');
    const failures = [];
    for (let index = 0; index < 4; index += 1) {
      const bad = await login(new Request('http://localhost:3000/api/participants/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': '127.0.0.21' }, body: JSON.stringify({ nickname: '보안', pin: '000000' }) }));
      failures.push({ status: bad.status, body: await bad.json(), retryAfter: bad.headers.get('retry-after') });
    }
    expect(failures.slice(0, 2).map(({ status }) => status)).toEqual([401, 401]);
    expect(failures.slice(2).map(({ status }) => status)).toEqual([429, 429]);
    expect(failures[0].body.error.code).toBe('invalid_credentials');
    expect(Number(failures[2].retryAfter)).toBeGreaterThan(0);

    const [session] = await database.db.select().from(participantSessions).limit(1);
    currentToken = registered.headers.get('set-cookie')?.match(new RegExp(`${authCookieNames(false).participant}=([^;]+)`))?.[1];
    await database.db.update(participantSessions).set({ expiresAt: new Date(0) }).where(eq(participantSessions.id, session.id));
    const { GET } = await import('@/app/api/me/route');
    expect((await GET()).status).toBe(401);
  });

  it('never hashes a PIN for an unknown or already blocked registration subject', async () => {
    const { POST } = await import('@/app/api/participants/register/route');
    expect((await POST(registration(undefined, '없는닉', '127.0.0.30'))).status).toBe(403);
    expect(hashSecret).not.toHaveBeenCalled();

    const subject = throttleSubject(eventId, normalizeNickname('보안').key, '127.0.0.31');
    await database.db.insert(authThrottles).values({
      action: 'participant_register',
      subjectKeyHash: subject,
      failureCount: 3,
      blockedUntil: new Date(Date.now() + 60_000),
    });
    expect((await POST(registration(undefined, '보안', '127.0.0.31'))).status).toBe(429);
    expect(hashSecret).not.toHaveBeenCalled();
  });

  it('allows only one concurrent claim of an approved profile', async () => {
    const { POST } = await import('@/app/api/participants/register/route');
    const responses = await Promise.all([
      POST(registration(undefined, '보안', '127.0.0.41')),
      POST(registration(undefined, '보안', '127.0.0.42')),
      POST(registration(undefined, '보안', '127.0.0.43')),
    ]);
    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(2);
    expect(await database.db.select().from(participants)).toHaveLength(1);
  });

  it('does not select either account when a direct nickname collides with another account alias', async () => {
    const { POST: register } = await import('@/app/api/participants/register/route');
    expect((await register(registration(undefined, '보안'))).status).toBe(201);
    const [event] = await database.db.select().from(events).limit(1);
    await participantFactory(database.db, event.id, {
      nicknameDisplay: '교차로그인',
      nicknameKey: '교차로그인',
    });

    const { POST: login } = await import('@/app/api/participants/login/route');
    async function rejected(nickname: string, ip: string) {
      const response = await login(new Request('http://localhost:3000/api/participants/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({
          nickname,
          pin: '123456',
        }),
      }));
      return { status: response.status, body: await response.json() };
    }

    expect(await rejected('교차로그인', '127.0.0.25')).toEqual(await rejected('미등록로그인', '127.0.0.26'));
    expect(await database.db.select().from(participants)).toHaveLength(2);
  });
});
