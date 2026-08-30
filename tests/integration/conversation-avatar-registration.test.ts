import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { avatarAssignments, conversationProfiles, participants } from '@/db/schema';
import { registerParticipant } from '@/lib/auth/participant-service';
import { createTestDatabase } from '@/tests/helpers/database';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';
import { eventFactory } from '@/tests/helpers/factories';

describe('conversation avatar registration transaction', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => database.reset());
  afterAll(async () => database?.close());

  it('rolls participant, PIN, avatar, and claim back together when a second alias races', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '대표닉', aliases: ['별칭닉'] }]);
    const [first, second] = await Promise.allSettled([
      registerParticipant({ inviteCode: 'test-invite-code-1234', nickname: '대표닉', pin: '123456', ipAddress: '192.0.2.1' }),
      registerParticipant({ inviteCode: 'test-invite-code-1234', nickname: '별칭닉', pin: '654321', ipAddress: '192.0.2.2' }),
    ]);
    expect([first, second].filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect([first, second].filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await database.db.select().from(participants)).toHaveLength(1);
    expect(await database.db.select().from(avatarAssignments)).toHaveLength(1);
    const [profile] = await database.db.select().from(conversationProfiles);
    expect(profile.claimedParticipantId).toBeTruthy();
  });
});
