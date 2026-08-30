import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { answers, participantSessions, questions } from '@/db/schema';
import { closeDatabase } from '@/lib/db/client';
import { digest } from '@/lib/security/crypto';
import { createTestDatabase } from '@/tests/helpers/database';
import { eventFactory, participantFactory, questionFactory } from '@/tests/helpers/factories';

let sessionToken: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => sessionToken ? { value: sessionToken } : undefined }),
}));

const csrfToken = 'answer-api-csrf-token';

function putRequest(content: string, csrf = csrfToken) {
  return new Request('http://localhost:3000/api/answer/current', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-csrf-token': csrf },
    body: JSON.stringify({ content }),
  });
}

describe('current question and answer API contract', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => {
    await database.reset();
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    const participant = await participantFactory(database.db, event.id);
    await questionFactory(database.db, event.id);
    sessionToken = `answer-session-${crypto.randomUUID()}`;
    await database.db.insert(participantSessions).values({
      participantId: participant.id,
      tokenHash: digest(sessionToken),
      csrfHash: digest(csrfToken),
      authVersion: participant.authVersion,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
  });
  afterAll(async () => { await closeDatabase(); await database?.close(); });

  it('returns the published question, then creates and reads the participant answer', async () => {
    const { GET: getQuestion } = await import('@/app/api/question/current/route');
    const questionResponse = await getQuestion();
    expect(questionResponse.status).toBe(200);
    const question = await questionResponse.json();
    expect(question).toMatchObject({ prompt: '기억에 남는 순간은?', status: 'published' });

    const { GET: getAnswer, PUT: putAnswer } = await import('@/app/api/answer/current/route');
    expect((await getAnswer()).status).toBe(404);

    const saved = await putAnswer(putRequest('  함께 만든 첫 프로젝트  '));
    expect(saved.status).toBe(200);
    const savedBody = await saved.json();
    expect(savedBody).toMatchObject({ questionId: question.id, content: '함께 만든 첫 프로젝트' });
    expect(savedBody.submittedAt).toBeTruthy();
    expect(savedBody.updatedAt).toBeTruthy();

    const current = await getAnswer();
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({ id: savedBody.id, content: savedBody.content });
  });

  it('requires a valid CSRF token and rejects updates after the question closes', async () => {
    const { PUT: putAnswer } = await import('@/app/api/answer/current/route');
    expect((await putAnswer(putRequest('기록', 'wrong-token'))).status).toBe(403);

    await database.db.update(questions).set({ status: 'closed' }).where(eq(questions.status, 'published'));
    const closed = await putAnswer(putRequest('닫힌 뒤 수정'));
    expect(closed.status).toBe(409);
    expect(await closed.json()).toMatchObject({ error: { code: 'question_unavailable' } });
    expect(await database.db.select().from(answers)).toHaveLength(0);
  });
});
