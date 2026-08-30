import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { answers, participantSessions } from '@/db/schema';
import { closeDatabase } from '@/lib/db/client';
import { digest } from '@/lib/security/crypto';
import { createTestDatabase } from '@/tests/helpers/database';
import { eventFactory, participantFactory, questionFactory } from '@/tests/helpers/factories';

let sessionToken: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => sessionToken ? { value: sessionToken } : undefined }),
}));

const csrfToken = 'answer-persistence-csrf';
function putRequest(content: string) {
  return new Request('http://localhost:3000/api/answer/current', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ content }),
  });
}

describe('answer ownership and persistence', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let firstToken: string;
  let secondToken: string;
  let firstParticipantId: string;
  let questionId: string;

  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => {
    await database.reset();
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    const first = await participantFactory(database.db, event.id);
    const second = await participantFactory(database.db, event.id);
    const question = await questionFactory(database.db, event.id);
    firstParticipantId = first.id;
    questionId = question.id;
    firstToken = `first-${crypto.randomUUID()}`;
    secondToken = `second-${crypto.randomUUID()}`;
    await database.db.insert(participantSessions).values([
      { participantId: first.id, tokenHash: digest(firstToken), csrfHash: digest(csrfToken), authVersion: first.authVersion, expiresAt: new Date(Date.now() + 10 * 60_000) },
      { participantId: second.id, tokenHash: digest(secondToken), csrfHash: digest(csrfToken), authVersion: second.authVersion, expiresAt: new Date(Date.now() + 10 * 60_000) },
    ]);
    sessionToken = firstToken;
  });
  afterAll(async () => { await closeDatabase(); await database?.close(); });

  it('validates trimmed content between 1 and 1,000 characters', async () => {
    const { PUT } = await import('@/app/api/answer/current/route');
    expect((await PUT(putRequest('   '))).status).toBe(400);
    expect((await PUT(putRequest('가'.repeat(1001)))).status).toBe(400);
    const boundary = await PUT(putRequest('가'.repeat(1000)));
    expect(boundary.status).toBe(200);
    expect((await boundary.json()).content).toHaveLength(1000);
  });

  it('keeps each answer private to its participant', async () => {
    const { GET, PUT } = await import('@/app/api/answer/current/route');
    await PUT(putRequest('첫 번째 참가자의 기록'));
    sessionToken = secondToken;
    expect((await GET()).status).toBe(404);
    await PUT(putRequest('두 번째 참가자의 기록'));

    const rows = await database.db.select().from(answers);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.participantId)).size).toBe(2);
  });

  it('atomically upserts concurrent changes and reconnects to the latest successful value', async () => {
    const { GET, PUT } = await import('@/app/api/answer/current/route');
    const results = await Promise.all([
      PUT(putRequest('동시에 저장한 A')),
      PUT(putRequest('동시에 저장한 B')),
    ]);
    expect(results.every((response) => response.status === 200)).toBe(true);

    const rows = await database.db.select().from(answers).where(and(
      eq(answers.participantId, firstParticipantId),
      eq(answers.questionId, questionId),
    ));
    expect(rows).toHaveLength(1);
    expect(['동시에 저장한 A', '동시에 저장한 B']).toContain(rows[0].content);

    await closeDatabase();
    const afterRestart = await GET();
    expect(afterRestart.status).toBe(200);
    expect((await afterRestart.json()).content).toBe(rows[0].content);
  });
});
