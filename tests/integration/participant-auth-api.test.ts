import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { participantSessions } from '@/db/schema';
import { authCookieNames } from '@/lib/auth/cookie-names';
import { createTestDatabase } from '@/tests/helpers/database';
import { eventFactory } from '@/tests/helpers/factories';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';

let sessionCookie: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => sessionCookie ? { value: sessionCookie } : undefined }),
}));

const cookieNames = authCookieNames(false);

function request(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': '127.0.0.10' }, body: JSON.stringify(body),
  });
}

function cookieValue(response: Response, name: string) {
  return response.headers.get('set-cookie')?.match(new RegExp(`${name}=([^;]+)`))?.[1];
}

describe('participant authentication API contract', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => {
    await database.reset();
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '프론트' }]);
    sessionCookie = undefined;
  });
  afterAll(async () => database?.close());

  it('registers, returns the current participant, logs out, and logs back in', async () => {
    const { POST: register } = await import('@/app/api/participants/register/route');
    const registered = await register(request('/api/participants/register', {
      inviteCode: 'test-invite-code-1234', nickname: '프론트', pin: '123456', pinConfirmation: '123456',
    }));
    expect(registered.status).toBe(201);
    expect(await registered.json()).toMatchObject({ nickname: '프론트', avatar: { catalogVersion: 'pixel-parts-v1' } });
    sessionCookie = cookieValue(registered, cookieNames.participant);
    const csrf = cookieValue(registered, cookieNames.participantCsrf);
    expect(sessionCookie).toBeTruthy();
    expect(csrf).toBeTruthy();

    const { GET: me } = await import('@/app/api/me/route');
    const current = await me();
    const currentBody = await current.json();
    expect(currentBody).toMatchObject({ nickname: '프론트', answerStatus: 'question-unavailable' });

    const { POST: logout } = await import('@/app/api/participants/logout/route');
    const loggedOut = await logout(new Request('http://localhost:3000/api/participants/logout', {
      method: 'POST', headers: { origin: 'http://localhost:3000', 'x-csrf-token': csrf! },
    }));
    expect(loggedOut.status).toBe(204);
    const [revoked] = await database.db.select().from(participantSessions).where(eq(participantSessions.id, (await database.db.select().from(participantSessions).limit(1))[0].id));
    expect(revoked.revokedAt).toBeInstanceOf(Date);

    const { POST: login } = await import('@/app/api/participants/login/route');
    const loggedIn = await login(request('/api/participants/login', {
      inviteCode: 'test-invite-code-1234', nickname: ' 프론트 ', pin: '123456',
    }));
    expect(loggedIn.status).toBe(200);
    expect(await loggedIn.json()).toMatchObject({ id: currentBody.id, nickname: '프론트', avatar: currentBody.avatar });
  });
});
