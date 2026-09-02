import { and, eq } from 'drizzle-orm';
import { adminAccounts } from '@/db/schema';
import { findEventBySlug } from '@/lib/db/repositories/participants';
import { closeDatabase, db } from '@/lib/db/client';
import { getEnv } from '@/lib/config/env';
import { hashSecret } from '@/lib/security/crypto';

async function main() {
  const env = getEnv();
  const event = await findEventBySlug(env.EVENT_SLUG);
  if (!event) throw new Error('행사를 찾지 못했습니다.');

  const [updated] = await db.update(adminAccounts).set({
    passwordHash: await hashSecret(env.ADMIN_PASSWORD),
    authVersion: adminAccounts.authVersion + 1,
    updatedAt: new Date(),
  }).where(and(
    eq(adminAccounts.eventId, event.id),
    eq(adminAccounts.username, env.ADMIN_USERNAME),
  )).returning({ id: adminAccounts.id });
  if (!updated) throw new Error('관리자 계정을 찾지 못했습니다.');
  console.log('관리자 비밀번호를 변경하고 기존 세션을 무효화했습니다.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : '관리자 비밀번호를 변경하지 못했습니다.');
  process.exitCode = 1;
}).finally(closeDatabase);
