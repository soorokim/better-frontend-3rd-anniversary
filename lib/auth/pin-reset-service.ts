import { and, eq, isNull } from 'drizzle-orm';
import { participantSessions, participants } from '@/db/schema';
import { getEnv } from '@/lib/config/env';
import { createAuditEvent } from '@/lib/db/repositories/audit';
import { findEventBySlug, findParticipantByNickname } from '@/lib/db/repositories/participants';
import { consumeGrant, createPinResetGrant, findActiveGrantForUpdate, recordGrantFailure, revokeActiveGrants } from '@/lib/db/repositories/pin-reset';
import { inTransaction } from '@/lib/db/transaction';
import { AppError } from '@/lib/http/errors';
import { hashSecret, randomNumericCode, randomToken, verifySecret } from '@/lib/security/crypto';
import { normalizeNickname } from '@/lib/validation/nickname';
import { clearThrottle, readThrottle, recordFailure, throttleSubject } from '@/lib/security/rate-limit';

const TEN_MINUTES = 10 * 60_000;

export async function issuePinReset(input: { adminId: string; eventId: string; participantId: string }) {
  const resetCode = randomNumericCode(8); const now = new Date(); const expiresAt = new Date(now.getTime() + TEN_MINUTES);
  const [codeHash, disabledPinHash] = await Promise.all([hashSecret(resetCode), hashSecret(randomToken())]);
  await inTransaction(async (tx) => {
    const [participant] = await tx.select().from(participants).where(and(eq(participants.id, input.participantId), eq(participants.eventId, input.eventId))).for('update').limit(1);
    if (!participant) throw new AppError('participant_not_found', '참가자를 찾을 수 없습니다.', 404);
    await revokeActiveGrants(participant.id, tx, now);
    await tx.update(participants).set({ pinHash: disabledPinHash, authVersion: participant.authVersion + 1, updatedAt: now }).where(eq(participants.id, participant.id));
    await tx.update(participantSessions).set({ revokedAt: now }).where(and(eq(participantSessions.participantId, participant.id), isNull(participantSessions.revokedAt)));
    await createPinResetGrant({ participantId: participant.id, codeHash, expiresAt, createdByAdminId: input.adminId }, tx);
    await createAuditEvent({ eventId: input.eventId, adminId: input.adminId, action: 'pin_reset_issued', targetParticipantId: participant.id, outcome: 'success' }, tx);
  });
  return { resetCode, expiresAt };
}

export async function completePinReset(input: { inviteCode: string; nickname: string; resetCode: string; newPin: string; ipAddress?: string }) {
  const event = await findEventBySlug(getEnv().EVENT_SLUG); const nickname = normalizeNickname(input.nickname);
  const throttleKey = input.ipAddress ? throttleSubject(nickname.key, input.ipAddress) : undefined;
  if (throttleKey) { const throttle = await readThrottle('pin_reset', throttleKey); if (throttle.blocked) throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, throttle.retryAfter); }
  async function invalidAttempt() {
    const failure = throttleKey ? await recordFailure('pin_reset', throttleKey) : undefined;
    throw new AppError(failure?.blocked ? 'rate_limited' : 'invalid_credentials', failure?.blocked ? '잠시 기다린 뒤 다시 시도해 주세요.' : '초기화 정보를 확인해 주세요.', failure?.blocked ? 429 : 401, undefined, failure?.retryAfter || undefined);
  }
  if (!event || !(await verifySecret(event.inviteCodeHash, input.inviteCode))) return invalidAttempt();
  const participant = await findParticipantByNickname(event.id, nickname.key);
  if (!participant) return invalidAttempt();
  const newPinHash = await hashSecret(input.newPin);
  const result = await inTransaction(async (tx) => {
    const [lockedParticipant] = await tx.select({ id: participants.id }).from(participants).where(eq(participants.id, participant.id)).for('update').limit(1);
    if (!lockedParticipant) return { outcome: 'gone' as const };
    const grant = await findActiveGrantForUpdate(participant.id, tx);
    if (!grant) return { outcome: 'gone' as const };
    if (!(await verifySecret(grant.codeHash, input.resetCode))) {
      const failures = grant.failureCount + 1; await recordGrantFailure(grant.id, failures, tx);
      await createAuditEvent({ eventId: event.id, adminId: grant.createdByAdminId, action: 'pin_reset_completed', targetParticipantId: participant.id, outcome: 'failure' }, tx);
      return { outcome: failures >= 5 ? 'gone' as const : 'invalid' as const };
    }
    await tx.update(participants).set({ pinHash: newPinHash, updatedAt: new Date() }).where(eq(participants.id, participant.id));
    await consumeGrant(grant.id, tx);
    await createAuditEvent({ eventId: event.id, adminId: grant.createdByAdminId, action: 'pin_reset_completed', targetParticipantId: participant.id, outcome: 'success' }, tx);
    return { outcome: 'success' as const };
  });
  if (result.outcome === 'gone') throw new AppError('reset_grant_gone', '초기화 코드가 만료되었거나 더 이상 사용할 수 없습니다.', 410);
  if (result.outcome === 'invalid') return invalidAttempt();
  if (throttleKey) await clearThrottle('pin_reset', throttleKey);
}
