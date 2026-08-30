import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { authThrottles, participants } from '@/db/schema';
import { createTestDatabase } from '@/tests/helpers/database';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';
import { eventFactory } from '@/tests/helpers/factories';
import { normalizeNickname } from '@/lib/validation/nickname';
import {
  consumeRegistrationAttempt,
  throttleSubject,
} from '@/lib/security/rate-limit';

const registerRequest = (nickname: string, ipAddress: string) => new Request(
  'http://localhost:3000/api/participants/register',
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': ipAddress,
    },
    body: JSON.stringify({
      inviteCode: 'test-invite-code-1234',
      nickname,
      pin: '123456',
      pinConfirmation: '123456',
    }),
  },
);

describe('participant registration throttle', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let eventId: string;

  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => {
    await database.reset();
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    eventId = event.id;
    await conversationProfileBatchFactory(database.db, event.id, [
      { nickname: '승인닉' },
      { nickname: '다른승인닉' },
    ]);
  });
  afterAll(async () => database?.close());

  it('accumulates unknown-name attempts only for the same event, nickname, and IP subject', async () => {
    const { POST } = await import('@/app/api/participants/register/route');
    const statuses = [];
    for (let index = 0; index < 3; index += 1) {
      statuses.push((await POST(registerRequest('미승인닉', '192.0.2.10'))).status);
    }
    expect(statuses).toEqual([403, 403, 429]);

    expect((await POST(registerRequest('다른미승인닉', '192.0.2.10'))).status).toBe(403);
    expect((await POST(registerRequest('미승인닉', '192.0.2.11'))).status).toBe(403);
    expect(await database.db.select().from(participants)).toHaveLength(0);
  });

  it('atomically consumes parallel slots and starts a new window after expiry', async () => {
    const subject = throttleSubject(eventId, normalizeNickname('승인닉').key, '192.0.2.20');
    const attempts = await Promise.all([
      consumeRegistrationAttempt(subject),
      consumeRegistrationAttempt(subject),
      consumeRegistrationAttempt(subject),
    ]);
    expect(attempts.filter(({ blocked }) => !blocked)).toHaveLength(2);
    expect(attempts.filter(({ blocked }) => blocked)).toHaveLength(1);

    await database.db.update(authThrottles).set({
      windowStartedAt: new Date(Date.now() - 16 * 60_000),
      blockedUntil: new Date(Date.now() - 1_000),
    }).where(and(
      eq(authThrottles.action, 'participant_register'),
      eq(authThrottles.subjectKeyHash, subject),
    ));

    expect(await consumeRegistrationAttempt(subject)).toMatchObject({ blocked: false, retryAfter: 0 });
  });

  it('clears only the successful registration subject', async () => {
    const successSubject = throttleSubject(eventId, normalizeNickname('승인닉').key, '192.0.2.30');
    const otherSubject = throttleSubject(eventId, normalizeNickname('다른승인닉').key, '192.0.2.30');
    await consumeRegistrationAttempt(successSubject);
    await consumeRegistrationAttempt(otherSubject);

    const { POST } = await import('@/app/api/participants/register/route');
    expect((await POST(registerRequest('승인닉', '192.0.2.30'))).status).toBe(201);

    const rows = await database.db.select().from(authThrottles)
      .where(eq(authThrottles.action, 'participant_register'));
    expect(rows.map(({ subjectKeyHash }) => subjectKeyHash)).not.toContain(successSubject);
    expect(rows.map(({ subjectKeyHash }) => subjectKeyHash)).toContain(otherSubject);
  });
});
