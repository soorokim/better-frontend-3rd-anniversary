import { and, eq } from 'drizzle-orm';
import { authThrottles } from '@/db/schema';
import { db } from '@/lib/db/client';
import { digest } from './crypto';

export type ThrottleAction = 'invite' | 'participant_login' | 'admin_login' | 'pin_reset' | 'participant_register';
const WINDOW_MS = 15 * 60_000;

function delaySeconds(failures: number): number { return failures < 3 ? 0 : Math.min(300, 2 ** (failures - 3)); }
export function retryAfter(blockedUntil: Date | null, now = new Date()): number { return blockedUntil ? Math.max(0, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)) : 0; }
export function throttleSubject(...parts: string[]): string { return digest(parts.join('\0')); }

export async function readThrottle(action: ThrottleAction, subjectKeyHash: string) {
  const [row] = await db.select().from(authThrottles).where(and(eq(authThrottles.action, action), eq(authThrottles.subjectKeyHash, subjectKeyHash))).limit(1);
  return { blocked: Boolean(row?.blockedUntil && row.blockedUntil > new Date()), retryAfter: retryAfter(row?.blockedUntil ?? null) };
}

export async function recordFailure(action: ThrottleAction, subjectKeyHash: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(authThrottles).where(and(eq(authThrottles.action, action), eq(authThrottles.subjectKeyHash, subjectKeyHash))).for('update').limit(1);
    const now = new Date(); const expired = !existing || now.getTime() - existing.windowStartedAt.getTime() > WINDOW_MS;
    const failures = expired ? 1 : existing.failureCount + 1; const seconds = delaySeconds(failures); const blockedUntil = seconds ? new Date(now.getTime() + seconds * 1000) : null;
    if (!existing) await tx.insert(authThrottles).values({ action, subjectKeyHash, failureCount: failures, blockedUntil });
    else await tx.update(authThrottles).set({ failureCount: failures, windowStartedAt: expired ? now : existing.windowStartedAt, blockedUntil, updatedAt: now }).where(eq(authThrottles.id, existing.id));
    return { blocked: seconds > 0, retryAfter: seconds };
  });
}

export async function consumeRegistrationAttempt(subjectKeyHash: string) {
  return db.transaction(async (tx) => {
    await tx.insert(authThrottles).values({
      action: 'participant_register',
      subjectKeyHash,
      failureCount: 0,
    }).onConflictDoNothing({
      target: [authThrottles.action, authThrottles.subjectKeyHash],
    });

    const [existing] = await tx.select().from(authThrottles).where(and(
      eq(authThrottles.action, 'participant_register'),
      eq(authThrottles.subjectKeyHash, subjectKeyHash),
    )).for('update').limit(1);
    if (!existing) throw new Error('가입 제한 상태를 만들지 못했습니다.');

    const now = new Date();
    if (existing.blockedUntil && existing.blockedUntil > now) {
      return { blocked: true, retryAfter: retryAfter(existing.blockedUntil, now) };
    }

    const expired = now.getTime() - existing.windowStartedAt.getTime() > WINDOW_MS;
    const attempts = expired ? 1 : existing.failureCount + 1;
    const seconds = delaySeconds(attempts);
    await tx.update(authThrottles).set({
      failureCount: attempts,
      windowStartedAt: expired ? now : existing.windowStartedAt,
      blockedUntil: seconds ? new Date(now.getTime() + seconds * 1000) : null,
      updatedAt: now,
    }).where(eq(authThrottles.id, existing.id));
    return { blocked: seconds > 0, retryAfter: seconds };
  });
}

export async function clearThrottle(action: ThrottleAction, subjectKeyHash: string): Promise<void> {
  await db.delete(authThrottles).where(and(eq(authThrottles.action, action), eq(authThrottles.subjectKeyHash, subjectKeyHash)));
}
