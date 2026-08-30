import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { adminSessions, answers, avatarAssignments, participants } from '@/db/schema';
import { authCookieNames } from '@/lib/auth/cookie-names';
import { issueSession } from '@/lib/auth/session';
import { createTestDatabase } from '@/tests/helpers/database';
import { adminFactory, eventFactory, participantFactory, questionFactory } from '@/tests/helpers/factories';

let adminCookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => adminCookie ? { value: adminCookie } : undefined }) }));
const names = authCookieNames(false);
const post = (path: string, body?: unknown, csrf?: string) => new Request(`http://localhost:3000${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': '127.0.0.31', ...(csrf ? { 'x-csrf-token': csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookie = (response: Response, name: string) => response.headers.get('set-cookie')?.match(new RegExp(`${name}=([^;]+)`))?.[1];

describe('admin API contract', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => { await database.reset(); adminCookie = undefined; });
  afterAll(async () => database?.close());

  it('uses a separate admin session and exposes only safe participant status fields', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    const admin = await adminFactory(database.db, event.id);
    const submitted = await participantFactory(database.db, event.id, { nicknameDisplay: '가나다', nicknameKey: '가나다' });
    const pending = await participantFactory(database.db, event.id, { nicknameDisplay: '라마바', nicknameKey: '라마바' });
    for (const participant of [submitted, pending]) {
      const [avatar] = await database.db.insert(avatarAssignments).values({ participantId: participant.id, sourceKind: 'nickname', sourceVersion: 'nickname-key-v1', sourceDigest: 'digest', generatorVersion: 'avatar-v1', catalogVersion: 'pixel-parts-v1', selectedTraits: { hair: 'bob', body: 'warm', outfit: 'hoodie', accessory: 'none', accent: 'pink' } }).returning();
      await database.db.update(participants).set({ currentAvatarId: avatar.id }).where(eq(participants.id, participant.id));
    }
    const question = await questionFactory(database.db, event.id);
    await database.db.insert(answers).values({ participantId: submitted.id, questionId: question.id, content: '절대 목록에 노출하면 안 되는 답변' });
    const { POST: login } = await import('@/app/api/admin/login/route');
    const loggedIn = await login(post('/api/admin/login', { username: admin.username, password: 'a-test-admin-password' }));
    expect(loggedIn.status).toBe(200);
    adminCookie = cookie(loggedIn, names.admin);
    const csrf = cookie(loggedIn, names.adminCsrf);
    expect(adminCookie).toBeTruthy(); expect(csrf).toBeTruthy();
    const { GET: list } = await import('@/app/api/admin/participants/route');
    const response = await list(); const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.participants.map((p: { nickname: string }) => p.nickname)).toEqual(['가나다', '라마바']);
    expect(body.participants[0]).toMatchObject({ answerStatus: 'submitted', avatar: { catalogVersion: 'pixel-parts-v1' } });
    expect(JSON.stringify(body)).not.toContain('절대 목록에 노출');
    expect(Object.keys(body.participants[0]).sort()).toEqual(['answerStatus', 'avatar', 'id', 'joinedAt', 'nickname']);
    const { POST: logout } = await import('@/app/api/admin/logout/route');
    expect((await logout(post('/api/admin/logout', undefined, csrf))).status).toBe(204);
    expect((await list()).status).toBe(401);
  });

  it('does not accept a participant session as admin authorization', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    const participant = await participantFactory(database.db, event.id);
    adminCookie = (await issueSession('participant', participant.id, participant.authVersion)).token;
    const { GET } = await import('@/app/api/admin/participants/route');
    expect((await GET()).status).toBe(401);
  });

  it('applies the 15 minute idle and 4 hour absolute admin session limits', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' }); const admin = await adminFactory(database.db, event.id);
    const issuedAt = Date.now(); const session = await issueSession('admin', admin.id, admin.authVersion); adminCookie = session.token;
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(issuedAt + 4 * 60 * 60_000 - 1000);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(issuedAt + 4 * 60 * 60_000 + 1000);
    await database.db.update(adminSessions).set({ lastSeenAt: new Date(Date.now() - 16 * 60_000) }).where(eq(adminSessions.adminId, admin.id));
    const { GET } = await import('@/app/api/admin/participants/route'); expect((await GET()).status).toBe(401);
  });
});
