import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { auditEvents, participantSessions, participants, pinResetGrants } from '@/db/schema';
import { completePinReset, issuePinReset } from '@/lib/auth/pin-reset-service';
import { issueSession } from '@/lib/auth/session';
import { verifySecret } from '@/lib/security/crypto';
import { createTestDatabase } from '@/tests/helpers/database';
import { adminFactory, eventFactory, participantFactory } from '@/tests/helpers/factories';

describe('PIN reset security boundaries', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); }); beforeEach(async () => database.reset()); afterAll(async () => database?.close());
  it('atomically increments auth_version, revokes every session and prior grant, and stores secret-free audit rows', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' }); const admin = await adminFactory(database.db, event.id); const participant = await participantFactory(database.db, event.id);
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
});
