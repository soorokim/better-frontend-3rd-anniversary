import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { conversationProfiles } from '@/db/schema';
import {
  claimConversationProfile,
  findActiveConversationProfileBatch,
  findConversationProfile,
} from '@/lib/db/repositories/conversation-profiles';
import { createTestDatabase } from '@/tests/helpers/database';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';
import { eventFactory, participantFactory } from '@/tests/helpers/factories';

describe('conversation profile repository', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => database.reset());
  afterAll(async () => database?.close());

  it('looks up only an active batch and maps every approved alias to one profile', async () => {
    const event = await eventFactory(database.db);
    await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '새닉네임' }], 'staged');
    expect(await findConversationProfile(event.id, '새닉네임')).toBeUndefined();
    const active = await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '대표닉', aliases: ['예전닉'] }]);
    expect((await findActiveConversationProfileBatch(event.id))?.id).toBe(active.batch.id);
    expect((await findConversationProfile(event.id, '예전닉'))?.id).toBe(active.profiles[0].id);
  });

  it('lets only one concurrent participant claim an unclaimed profile', async () => {
    const event = await eventFactory(database.db);
    const { profiles } = await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '경쟁닉' }]);
    const first = await participantFactory(database.db, event.id);
    const second = await participantFactory(database.db, event.id);
    const results = await Promise.all([
      database.db.transaction((tx) => claimConversationProfile(profiles[0].id, first.id, tx)),
      database.db.transaction((tx) => claimConversationProfile(profiles[0].id, second.id, tx)),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const [stored] = await database.db.select().from(conversationProfiles);
    expect([first.id, second.id]).toContain(stored.claimedParticipantId);
  });
});
