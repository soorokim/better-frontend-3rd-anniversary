import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { avatarAssignments, participants } from '@/db/schema';
import { createTestDatabase } from '@/tests/helpers/database';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';
import { eventFactory } from '@/tests/helpers/factories';

const request = (path: string, body: unknown, origin = 'http://localhost:3000', ipAddress?: string) => new Request(`http://localhost:3000${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': ipAddress ?? `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  body: JSON.stringify(body),
});

describe('conversation avatar registration contract', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => database.reset());
  afterAll(async () => database?.close());

  it('verifies Origin, invitation, and the active full batch before opening nickname input', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    const { POST } = await import('@/app/api/invitations/verify/route');
    expect((await POST(request('/api/invitations/verify', { inviteCode: 'test-invite-code-1234' }, 'https://attacker.example'))).status).toBe(403);
    expect((await POST(request('/api/invitations/verify', { inviteCode: 'wrong-invite-code-0000' }))).status).toBe(401);
    const notReady = await POST(request('/api/invitations/verify', { inviteCode: 'test-invite-code-1234' }));
    expect(notReady.status).toBe(503);
    expect((await notReady.json()).error.code).toBe('profile_batch_not_ready');
    await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '승인닉', aliases: ['예전닉'] }]);
    expect(await (await POST(request('/api/invitations/verify', { inviteCode: 'test-invite-code-1234' }))).json()).toEqual({ verified: true });
  });

  it('atomically registers an approved alias and rejects unknown or claimed names without side effects', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '승인닉', aliases: ['예전닉'] }]);
    const { POST } = await import('@/app/api/participants/register/route');
    const invalidPin = await POST(request('/api/participants/register', { inviteCode: 'test-invite-code-1234', nickname: '승인닉', pin: '123456', pinConfirmation: '654321' }));
    expect(invalidPin.status).toBe(400);
    expect((await invalidPin.json()).error).toMatchObject({ code: 'validation_error', field: 'pinConfirmation' });
    const unknown = await POST(request('/api/participants/register', { inviteCode: 'test-invite-code-1234', nickname: '없는닉', pin: '123456', pinConfirmation: '123456' }));
    expect(unknown.status).toBe(403);
    expect((await unknown.json()).error).toMatchObject({ code: 'nickname_not_invited', field: 'nickname' });
    expect(await database.db.select().from(participants)).toHaveLength(0);

    const registered = await POST(request('/api/participants/register', { inviteCode: 'test-invite-code-1234', nickname: '예전닉', pin: '123456', pinConfirmation: '123456' }));
    expect(registered.status).toBe(201);
    expect(await registered.json()).toMatchObject({ nickname: '승인닉', avatar: { sourceKind: 'conversation' }, reveal: { serverProgress: false } });
    expect(await database.db.select().from(participants)).toHaveLength(1);
    expect(await database.db.select().from(avatarAssignments)).toHaveLength(1);

    const duplicate = await POST(request('/api/participants/register', { inviteCode: 'test-invite-code-1234', nickname: '승인닉', pin: '654321', pinConfirmation: '654321' }));
    expect(duplicate.status).toBe(409);
    expect(await database.db.select().from(participants)).toHaveLength(1);
    expect(await database.db.select().from(avatarAssignments)).toHaveLength(1);
  });

  it('returns one consistent retry time while other nicknames remain able to register', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    const approvedNames = Array.from({ length: 20 }, (_, index) => `참가자${String(index + 1).padStart(2, '0')}`);
    await conversationProfileBatchFactory(database.db, event.id, approvedNames.map((nickname) => ({ nickname })));
    const { POST } = await import('@/app/api/participants/register/route');
    const sharedIp = '198.51.100.210';

    const failures = [];
    for (let index = 0; index < 3; index += 1) {
      failures.push(await POST(request('/api/participants/register', {
        inviteCode: 'test-invite-code-1234', nickname: '없는닉', pin: '123456', pinConfirmation: '123456',
      }, undefined, sharedIp)));
    }
    expect(failures.map(({ status }) => status)).toEqual([403, 403, 429]);
    const limitedBody = await failures[2].json();
    const retryAfter = Number(failures[2].headers.get('retry-after'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(limitedBody.error).toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: retryAfter,
    });
    expect(limitedBody.error.message).toContain('기다린 뒤 다시 시도');

    const measurements = await Promise.all(approvedNames.map(async (nickname) => {
      const startedAt = performance.now();
      const response = await POST(request(
        '/api/participants/register',
        { inviteCode: 'test-invite-code-1234', nickname, pin: '123456', pinConfirmation: '123456' },
        undefined,
        sharedIp,
      ));
      return { response, durationMs: performance.now() - startedAt };
    }));
    expect(measurements.every(({ response }) => response.status === 201)).toBe(true);
    const sortedDurations = measurements.map(({ durationMs }) => durationMs).sort((left, right) => left - right);
    const p95Ms = sortedDurations[Math.ceil(sortedDurations.length * 0.95) - 1];
    expect(p95Ms).toBeLessThan(2_000);
    console.info(JSON.stringify({ event: 'registration_benchmark', successfulRegistrations: 20, p95Ms: Math.round(p95Ms) }));
    expect(await database.db.select().from(participants)).toHaveLength(20);
  }, 30_000);
});
