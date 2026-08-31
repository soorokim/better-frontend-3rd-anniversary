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
  const prompts = [
    '3주년에 대한 감상이나 소감',
    '지식 / 아이디어 공유',
    '올해 좋은 일 자랑하기',
    '더 하고 싶은 말',
  ];
  for (const [index, prompt] of prompts.entries()) {
    await db.insert(questions).values({ eventId: existing.id, prompt, displayOrder: index + 1, status: 'published', publishedAt: new Date() })
      .onConflictDoNothing({ target: [questions.eventId, questions.displayOrder] });
  }
}

seed().finally(closeDatabase).catch((error) => { console.error('초기 데이터 생성 실패'); console.error(error instanceof Error ? error.message : '알 수 없는 오류'); process.exitCode = 1; });
