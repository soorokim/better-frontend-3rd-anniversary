import { eq } from 'drizzle-orm';
import { adminAccounts, events, questions } from './schema';
import { db, closeDatabase } from '../lib/db/client';
import { hashSecret } from '../lib/security/crypto';
import { getEnv } from '../lib/config/env';

async function seed() {
  const env = getEnv();
  const [event] = await db.insert(events).values({ slug: env.EVENT_SLUG, title: env.EVENT_TITLE, inviteCodeHash: await hashSecret(env.INVITE_CODE) }).onConflictDoNothing({ target: events.slug }).returning();
  const existing = event ?? (await db.select().from(events).where(eq(events.slug, env.EVENT_SLUG)).limit(1))[0];
  if (!existing) throw new Error('행사 초기화에 실패했습니다.');
  await db.insert(adminAccounts).values({ eventId: existing.id, username: env.ADMIN_USERNAME, passwordHash: await hashSecret(env.ADMIN_PASSWORD) }).onConflictDoNothing({ target: [adminAccounts.eventId, adminAccounts.username] });
  const published = await db.select({ id: questions.id }).from(questions).where(eq(questions.eventId, existing.id)).limit(1);
  if (!published.length) await db.insert(questions).values({ eventId: existing.id, prompt: env.EVENT_QUESTION, status: 'published', publishedAt: new Date() });
}

seed().finally(closeDatabase).catch((error) => { console.error('초기 데이터 생성 실패'); console.error(error instanceof Error ? error.message : '알 수 없는 오류'); process.exitCode = 1; });
