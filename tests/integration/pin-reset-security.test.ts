import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { auditEvents, participantSessions, participants, pinResetGrants } from '@/db/schema';
import { completePinReset, issuePinReset } from '@/lib/auth/pin-reset-service';
import { issueSession } from '@/lib/auth/session';
import { claimConversationProfile } from '@/lib/db/repositories/conversation-profiles';
import { AppError } from '@/lib/http/errors';
import { verifySecret } from '@/lib/security/crypto';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';
import { createTestDatabase } from '@/tests/helpers/database';
import { adminFactory, eventFactory, participantFactory } from '@/tests/helpers/factories';

describe('PIN reset security boundaries', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); }); beforeEach(async () => database.reset()); afterAll(async () => database?.close());
  it('atomically increments auth_version, revokes every session and prior grant, and stores secret-free audit rows', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' }); const admin = await adminFactory(database.db, event.id); const participant = await participantFactory(database.db, event.id);
    const { profiles } = await conversationProfileBatchFactory(database.db, event.id, [{ nickname: participant.nicknameDisplay }]);
    await claimConversationProfile(profiles[0].id, participant.id, database.db);
    await Promise.all([issueSession('participant', participant.id, participant.authVersion), issueSession('participant', participant.id, participant.authVersion)]);
    const old = await issuePinReset({ adminId: admin.id, eventId: event.id, participantId: participant.id });
    const current = await issuePinReset({ adminId: admin.id, eventId: event.id, participantId: participant.id });
    const [changed] = await database.db.select().from(participants).where(eq(participants.id, participant.id)); expect(changed.authVersion).toBe(participant.authVersion + 2);
    expect((await database.db.select().from(participantSessions)).every((row) => row.revokedAt instanceof Date)).toBe(true);
    expect((await database.db.select().from(pinResetGrants).where(eq(pinResetGrants.participantId, participant.id)))[0].revokedAt).toBeInstanceOf(Date);
    expect(old.resetCode).not.toBe(current.resetCode);
    const audits = await database.db.select().from(auditEvents); expect(audits).toHaveLength(2);
    for (const row of audits) { expect(Object.keys(row).sort()).toEqual(['action', 'adminId', 'createdAt', 'eventId', 'id', 'outcome', 'targetParticipantId']); expect(JSON.stringify(row)).not.toContain(current.resetCode); }
    await completePinReset({ inviteCode: 'test-invite-code-1234', nickname: participant.nicknameDisplay, resetCode: current.resetCode, newPin: '654321' });
    const [updated] = await database.db.select().from(participants).where(eq(participants.id, participant.id)); expect(await verifySecret(updated.pinHash, '654321')).toBe(true); expect(await verifySecret(updated.pinHash, '123456')).toBe(false);
  });

  it('gives unknown and ambiguous names the same error across twenty attempts without changing an account', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    const admin = await adminFactory(database.db, event.id);
    const { profiles } = await conversationProfileBatchFactory(database.db, event.id, [{
      nickname: '프로필주인',
      aliases: ['교차닉'],
    }]);
    const profileOwner = await participantFactory(database.db, event.id, {
      nicknameDisplay: '프로필주인',
      nicknameKey: '프로필주인',
    });
    await participantFactory(database.db, event.id, {
      nicknameDisplay: '교차닉',
      nicknameKey: '교차닉',
    });
    expect(await claimConversationProfile(profiles[0].id, profileOwner.id, database.db)).toBe(true);
    await issuePinReset({ adminId: admin.id, eventId: event.id, participantId: profileOwner.id });

    const beforeParticipants = (await database.db.select().from(participants))
      .map(({ id, pinHash, authVersion, currentAvatarId }) => ({ id, pinHash, authVersion, currentAvatarId }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const beforeGrants = await database.db.select().from(pinResetGrants);

    async function rejected(name: string) {
      try {
        await completePinReset({
          inviteCode: 'test-invite-code-1234',
          nickname: name,
          resetCode: '00000000',
          newPin: '654321',
        });
        throw new Error('PIN 초기화가 거절되지 않았습니다.');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        return { code: appError.code, message: appError.message, status: appError.status };
      }
    }

    const unknownErrors = [];
    const ambiguousErrors = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      unknownErrors.push(await rejected('미등록닉'));
      ambiguousErrors.push(await rejected('교차닉'));
    }
    const expected = {
      code: 'invalid_credentials',
      message: '초기화 정보를 확인해 주세요.',
      status: 401,
    };
    expect(unknownErrors).toEqual(Array.from({ length: 20 }, () => expected));
    expect(ambiguousErrors).toEqual(Array.from({ length: 20 }, () => expected));

    const afterParticipants = (await database.db.select().from(participants))
      .map(({ id, pinHash, authVersion, currentAvatarId }) => ({ id, pinHash, authVersion, currentAvatarId }))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(afterParticipants).toEqual(beforeParticipants);
    expect(await database.db.select().from(pinResetGrants)).toEqual(beforeGrants);
  }, 60_000);
});
