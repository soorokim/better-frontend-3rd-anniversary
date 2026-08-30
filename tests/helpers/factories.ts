import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { adminAccounts, answers, events, participants, questions } from '@/db/schema';
import { hashSecret } from '@/lib/security/crypto';

type TestDatabase = PostgresJsDatabase<typeof import('@/db/schema')>;

export async function eventFactory(db: PostgresJsDatabase<typeof import('@/db/schema')>, overrides: Partial<typeof events.$inferInsert> = {}) {
  const [event] = await db.insert(events).values({ slug: `event-${crypto.randomUUID()}`, title: '테스트 행사', inviteCodeHash: await hashSecret('test-invite-code-1234'), ...overrides }).returning(); return event;
}
export async function participantFactory(db: TestDatabase, eventId: string, overrides: Partial<typeof participants.$inferInsert> = {}) {
  const name = `참가자-${crypto.randomUUID().slice(0, 6)}`; const [participant] = await db.insert(participants).values({ eventId, nicknameDisplay: name, nicknameKey: name.toLowerCase(), pinHash: await hashSecret('123456'), ...overrides }).returning(); return participant;
}
export async function answerFactory(
  db: TestDatabase,
  participantId: string,
  questionId: string,
  overrides: Partial<typeof answers.$inferInsert> = {},
) {
  const [answer] = await db.insert(answers).values({
    participantId,
    questionId,
    content: `발표할 테스트 답변 ${crypto.randomUUID().slice(0, 6)}`,
    ...overrides,
  }).returning();
  return answer;
}
export async function adminFactory(db: TestDatabase, eventId: string, overrides: Partial<typeof adminAccounts.$inferInsert> = {}) { const [admin] = await db.insert(adminAccounts).values({ eventId, username: 'host', passwordHash: await hashSecret('a-test-admin-password'), ...overrides }).returning(); return admin; }
export async function questionFactory(db: PostgresJsDatabase<typeof import('@/db/schema')>, eventId: string) { const [question] = await db.insert(questions).values({ eventId, prompt: '기억에 남는 순간은?', status: 'published', publishedAt: new Date() }).returning(); return question; }
