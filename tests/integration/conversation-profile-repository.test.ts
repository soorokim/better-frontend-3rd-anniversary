import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { conversationProfiles } from '@/db/schema';
import {
  claimConversationProfile,
  findActiveConversationProfileBatch,
  findConversationProfile,
  resolveParticipantName,
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

  it('resolves a canonical name and every approved alias to the same participant', async () => {
    const event = await eventFactory(database.db);
    const { profiles } = await conversationProfileBatchFactory(database.db, event.id, [{
      nickname: '대표닉',
      aliases: ['예전닉', '다른표기'],
    }]);
    const participant = await participantFactory(database.db, event.id, {
      nicknameDisplay: '대표닉',
      nicknameKey: '대표닉',
    });
    expect(await resolveParticipantName(event.id, '대표닉', database.db)).toEqual({
      status: 'resolved',
      participantId: participant.id,
      profileId: profiles[0].id,
    });
    expect(await resolveParticipantName(event.id, '예전닉', database.db)).toEqual({ status: 'not_found' });
    expect(await claimConversationProfile(profiles[0].id, participant.id, database.db)).toBe(true);

    for (const name of ['대표닉', '예전닉', '다른표기']) {
      expect(await resolveParticipantName(event.id, name, database.db)).toEqual({
        status: 'resolved',
        participantId: participant.id,
        profileId: profiles[0].id,
      });
    }
  });

  it('rejects direct-name and alias cross-account collisions without choosing an account', async () => {
    const event = await eventFactory(database.db);
    const { profiles } = await conversationProfileBatchFactory(database.db, event.id, [{
      nickname: '프로필주인',
      aliases: ['교차닉'],
    }]);
    const profileOwner = await participantFactory(database.db, event.id, {
      nicknameDisplay: '프로필주인',
      nicknameKey: '프로필주인',
    });
    const directNameOwner = await participantFactory(database.db, event.id, {
      nicknameDisplay: '교차닉',
      nicknameKey: '교차닉',
    });
    expect(await claimConversationProfile(profiles[0].id, profileOwner.id, database.db)).toBe(true);

    expect(await resolveParticipantName(event.id, '교차닉', database.db)).toEqual({
      status: 'ambiguous',
    });
    expect(profileOwner.id).not.toBe(directNameOwner.id);
  });

  it('does not resolve names from an inactive batch', async () => {
    const event = await eventFactory(database.db);
    const { profiles } = await conversationProfileBatchFactory(
      database.db,
      event.id,
      [{ nickname: '지난대표', aliases: ['지난별칭'] }],
      'staged',
    );
    const participant = await participantFactory(database.db, event.id, {
      nicknameDisplay: '지난대표',
      nicknameKey: '지난대표',
    });
    expect(await claimConversationProfile(profiles[0].id, participant.id, database.db)).toBe(true);

    expect(await resolveParticipantName(event.id, '지난대표', database.db)).toEqual({ status: 'not_found' });
    expect(await resolveParticipantName(event.id, '지난별칭', database.db)).toEqual({ status: 'not_found' });
  });
});
