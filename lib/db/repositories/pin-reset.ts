import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { pinResetGrants } from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';

export async function revokeActiveGrants(participantId: string, executor: Transaction | typeof db = db, now = new Date()) {
  await executor.update(pinResetGrants).set({ revokedAt: now }).where(and(eq(pinResetGrants.participantId, participantId), isNull(pinResetGrants.usedAt), isNull(pinResetGrants.revokedAt)));
}

export async function createPinResetGrant(input: { participantId: string; codeHash: string; expiresAt: Date; createdByAdminId: string }, executor: Transaction | typeof db = db) {
  const [grant] = await executor.insert(pinResetGrants).values(input).returning(); return grant;
}

export async function findActiveGrantForUpdate(participantId: string, executor: Transaction, now = new Date()) {
  const [grant] = await executor.select().from(pinResetGrants).where(and(eq(pinResetGrants.participantId, participantId), isNull(pinResetGrants.usedAt), isNull(pinResetGrants.revokedAt), gt(pinResetGrants.expiresAt, now))).orderBy(desc(pinResetGrants.createdAt)).for('update').limit(1);
  return grant;
}

export async function recordGrantFailure(grantId: string, failureCount: number, executor: Transaction, now = new Date()) {
  await executor.update(pinResetGrants).set({ failureCount, revokedAt: failureCount >= 5 ? now : null }).where(eq(pinResetGrants.id, grantId));
}

export async function consumeGrant(grantId: string, executor: Transaction, now = new Date()) {
  await executor.update(pinResetGrants).set({ usedAt: now }).where(eq(pinResetGrants.id, grantId));
}
