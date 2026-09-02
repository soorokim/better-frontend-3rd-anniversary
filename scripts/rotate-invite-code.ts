import { eq } from 'drizzle-orm';
import { events } from '../db/schema';
import { closeDatabase, db } from '../lib/db/client';
import { getEnv } from '../lib/config/env';
import { hashSecret } from '../lib/security/crypto';

async function rotateInviteCode() {
  const env = getEnv();
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.slug, env.EVENT_SLUG)).limit(1);
  if (!event) throw new Error('초대 코드를 바꿀 행사를 찾지 못했습니다. EVENT_SLUG를 확인해 주세요.');

  await db.update(events).set({ inviteCodeHash: await hashSecret(env.INVITE_CODE), updatedAt: new Date() })
    .where(eq(events.id, event.id));
  console.log('초대 코드 해시를 갱신했습니다.');
}

rotateInviteCode().finally(closeDatabase).catch((error) => {
  console.error(error instanceof Error ? error.message : '초대 코드 갱신 실패');
  process.exitCode = 1;
});
