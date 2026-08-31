import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import {
  adminSessions,
  answers,
  auditEvents,
  avatarAssignments,
  conversationProfiles,
  participantSessions,
  participants,
} from '@/db/schema';
import { issueSession } from '@/lib/auth/session';
import { csrfDigest } from '@/lib/security/csrf';
import { claimConversationProfile } from '@/lib/db/repositories/conversation-profiles';
import { createAuditEvent } from '@/lib/db/repositories/audit';
import { createTestDatabase } from '@/tests/helpers/database';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';
import { adminFactory, answerFactory, eventFactory, participantFactory, questionFactory } from '@/tests/helpers/factories';

let adminCookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => adminCookie ? { value: adminCookie } : undefined }) }));
const csrf = 'csrf-for-participant-delete-000000000000';
const request = (participantId: string, body: object = {}) => new Request(`http://localhost:3000/api/admin/participants/${participantId}`, {
  method: 'DELETE',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-csrf-token': csrf },
  body: JSON.stringify(body),
});

describe('admin participant deletion', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => { await database.reset(); adminCookie = undefined; });
  afterAll(async () => database?.close());

  async function setup() {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    const admin = await adminFactory(database.db, event.id);
    const participant = await participantFactory(database.db, event.id, { nicknameDisplay: '삭제대상', nicknameKey: '삭제대상' });
    const { profiles } = await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '삭제대상' }]);
    await claimConversationProfile(profiles[0].id, participant.id, database.db);
    const [avatar] = await database.db.insert(avatarAssignments).values({
      participantId: participant.id,
      sourceKind: 'conversation',
      sourceVersion: 'kakao-conversation-v1',
      sourceDigest: profiles[0].sourceDigest,
      generatorVersion: 'developer-profile-v1',
      catalogVersion: 'pixel-parts-v1',
      selectedTraits: { hair: 'bob', body: 'warm', outfit: 'hoodie', accessory: 'none', accent: 'pink' },
      conversationProfileId: profiles[0].id,
    }).returning();
    await database.db.update(participants).set({ currentAvatarId: avatar.id }).where(eq(participants.id, participant.id));
    const question = await questionFactory(database.db, event.id);
    await answerFactory(database.db, participant.id, question.id);
    await issueSession('participant', participant.id, participant.authVersion);
    await createAuditEvent({ eventId: event.id, adminId: admin.id, action: 'pin_reset_issued', targetParticipantId: participant.id, outcome: 'success' });
    const session = await issueSession('admin', admin.id, admin.authVersion);
    adminCookie = session.token;
    await database.db.update(adminSessions).set({ csrfHash: csrfDigest(csrf) }).where(eq(adminSessions.adminId, admin.id));
    return { event, admin, participant, profile: profiles[0] };
  }

  it('deletes only the selected account and releases its conversation profile', async () => {
    const { participant, profile } = await setup();
    const route = await import('@/app/api/admin/participants/[participantId]/route');

    const response = await route.DELETE(request(participant.id), { params: Promise.resolve({ participantId: participant.id }) });

    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await database.db.select().from(participants).where(eq(participants.id, participant.id))).toHaveLength(0);
    expect(await database.db.select().from(answers).where(eq(answers.participantId, participant.id))).toHaveLength(0);
    expect(await database.db.select().from(avatarAssignments).where(eq(avatarAssignments.participantId, participant.id))).toHaveLength(0);
    expect(await database.db.select().from(participantSessions).where(eq(participantSessions.participantId, participant.id))).toHaveLength(0);
    const [released] = await database.db.select().from(conversationProfiles).where(eq(conversationProfiles.id, profile.id));
    expect(released.claimedParticipantId).toBeNull();
    expect(released.claimedAt).toBeNull();
    const targetedAudits = await database.db.select().from(auditEvents).where(eq(auditEvents.action, 'pin_reset_issued'));
    expect(targetedAudits[0].targetParticipantId).toBeNull();
    expect(await database.db.select().from(auditEvents).where(and(eq(auditEvents.action, 'participant_deleted'), eq(auditEvents.outcome, 'success')))).toHaveLength(1);
  });

  it('requires reauthentication when the admin login is no longer recent', async () => {
    const { participant } = await setup();
    await database.db.update(adminSessions).set({ authenticatedAt: new Date(Date.now() - 10 * 60_000) });
    const route = await import('@/app/api/admin/participants/[participantId]/route');

    expect((await route.DELETE(request(participant.id), { params: Promise.resolve({ participantId: participant.id }) })).status).toBe(403);
    expect(await database.db.select().from(participants).where(eq(participants.id, participant.id))).toHaveLength(1);
    expect((await route.DELETE(request(participant.id, { password: 'a-test-admin-password' }), { params: Promise.resolve({ participantId: participant.id }) })).status).toBe(204);
  });

  it('cannot delete a participant from another event', async () => {
    const { event } = await setup();
    const otherEvent = await eventFactory(database.db);
    const otherParticipant = await participantFactory(database.db, otherEvent.id);
    const route = await import('@/app/api/admin/participants/[participantId]/route');

    expect((await route.DELETE(request(otherParticipant.id), { params: Promise.resolve({ participantId: otherParticipant.id }) })).status).toBe(404);
    expect(await database.db.select().from(participants).where(eq(participants.id, otherParticipant.id))).toHaveLength(1);
    expect(await database.db.select().from(conversationProfiles).where(isNull(conversationProfiles.claimedParticipantId))).not.toHaveLength(0);
    expect(event.id).not.toBe(otherEvent.id);
  });
});
