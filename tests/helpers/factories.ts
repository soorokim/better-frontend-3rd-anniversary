import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { adminAccounts, events, participants, questions } from '@/db/schema';
import { hashSecret } from '@/lib/security/crypto';

export async function eventFactory(db: PostgresJsDatabase<typeof import('@/db/schema')>, overrides: Partial<typeof events.$inferInsert> = {}) {
  const [event] = await db.insert(events).values({ slug: `event-${crypto.randomUUID()}`, title: '테스트 행사', inviteCodeHash: await hashSecret('test-invite-code-1234'), ...overrides }).returning(); return event;
}
export async function participantFactory(db: PostgresJsDatabase<typeof import('@/db/schema')>, eventId: string, overrides: Partial<typeof participants.$inferInsert> = {}) {
  const name = `참가자-${crypto.randomUUID().slice(0, 6)}`; const [participant] = await db.insert(participants).values({ eventId, nicknameDisplay: name, nicknameKey: name.toLowerCase(), pinHash: await hashSecret('123456'), ...overrides }).returning(); return participant;
}
export async function adminFactory(db: PostgresJsDatabase<typeof import('@/db/schema')>, eventId: string) { const [admin] = await db.insert(adminAccounts).values({ eventId, username: 'host', passwordHash: await hashSecret('a-test-admin-password') }).returning(); return admin; }
export async function questionFactory(db: PostgresJsDatabase<typeof import('@/db/schema')>, eventId: string) { const [question] = await db.insert(questions).values({ eventId, prompt: '기억에 남는 순간은?', status: 'published', publishedAt: new Date() }).returning(); return question; }
