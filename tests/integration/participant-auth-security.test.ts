import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { participantSessions, participants } from '@/db/schema';
import { authCookieNames } from '@/lib/auth/cookie-names';
import { createTestDatabase } from '@/tests/helpers/database';
import { eventFactory } from '@/tests/helpers/factories';

let currentToken: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => currentToken ? { value: currentToken } : undefined }) }));

const registration = (inviteCode = 'test-invite-code-1234', nickname = '보안') => new Request('http://localhost:3000/api/participants/register', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': '127.0.0.20' },
  body: JSON.stringify({ inviteCode, nickname, pin: '123456', pinConfirmation: '123456' }),
});

describe('participant authentication security', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => { await database.reset(); await eventFactory(database.db, { slug: 'frontend-chat-3rd' }); currentToken = undefined; });
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
      const bad = await login(new Request('http://localhost:3000/api/participants/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': '127.0.0.21' }, body: JSON.stringify({ inviteCode: 'test-invite-code-1234', nickname: '보안', pin: '000000' }) }));
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
});
