import { and, eq, isNull, ne } from 'drizzle-orm';
import {
  conversationProfileAliases,
  conversationProfileBatches,
  conversationProfiles,
  participants,
  type ConversationProfileData,
} from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';

type Executor = typeof db | Transaction;

export async function findActiveConversationProfileBatch(eventId: string, executor: Executor = db) {
  const [batch] = await executor.select().from(conversationProfileBatches).where(and(
    eq(conversationProfileBatches.eventId, eventId),
    eq(conversationProfileBatches.status, 'active'),
  )).limit(1);
  return batch;
}

export async function findConversationProfile(
  eventId: string,
  aliasKey: string,
  executor: Executor = db,
) {
  const [row] = await executor.select({ profile: conversationProfiles })
    .from(conversationProfileAliases)
    .innerJoin(conversationProfiles, and(
      eq(conversationProfileAliases.profileId, conversationProfiles.id),
      eq(conversationProfileAliases.batchId, conversationProfiles.batchId),
    ))
    .innerJoin(conversationProfileBatches, and(
      eq(conversationProfiles.batchId, conversationProfileBatches.id),
      eq(conversationProfiles.eventId, conversationProfileBatches.eventId),
    ))
    .where(and(
      eq(conversationProfileBatches.eventId, eventId),
      eq(conversationProfiles.eventId, eventId),
      eq(conversationProfileBatches.status, 'active'),
      eq(conversationProfileAliases.aliasKey, aliasKey),
    ))
    .limit(1);
  return row?.profile;
}

export type ParticipantNameResolution =
  | { status: 'resolved'; participantId: string; profileId: string }
  | { status: 'not_found' }
  | { status: 'ambiguous' };

export async function resolveParticipantName(
  eventId: string,
  nicknameKey: string,
  executor: Executor = db,
): Promise<ParticipantNameResolution> {
  const [profile, directParticipants] = await Promise.all([
    findConversationProfile(eventId, nicknameKey, executor),
    executor.select({ id: participants.id }).from(participants).where(and(
      eq(participants.eventId, eventId),
      eq(participants.nicknameKey, nicknameKey),
    )).limit(2),
  ]);
  if (!profile) return { status: 'not_found' };
  const directIds = new Set(directParticipants.map(({ id }) => id));
  if (directIds.size > 1) return { status: 'ambiguous' };
  if (!profile.claimedParticipantId) {
    const directParticipantId = directParticipants[0]?.id;
    if (directParticipantId && nicknameKey === profile.nicknameKey) {
      return { status: 'resolved', participantId: directParticipantId, profileId: profile.id };
    }
    return directParticipantId ? { status: 'ambiguous' } : { status: 'not_found' };
  }
  if (directIds.size === 1 && !directIds.has(profile.claimedParticipantId)) {
    return { status: 'ambiguous' };
  }
  return {
    status: 'resolved',
    participantId: profile.claimedParticipantId,
    profileId: profile.id,
  };
}

export async function findConversationProfileById(profileId: string, executor: Executor = db) {
  const [profile] = await executor.select().from(conversationProfiles)
    .where(eq(conversationProfiles.id, profileId)).limit(1);
  return profile;
}

export async function claimConversationProfile(
  profileId: string,
  participantId: string,
  executor: Executor,
) {
  const [claimed] = await executor.update(conversationProfiles).set({
    claimedParticipantId: participantId,
    claimedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(conversationProfiles.id, profileId),
    isNull(conversationProfiles.claimedParticipantId),
  )).returning({ id: conversationProfiles.id });
  return Boolean(claimed);
}

export async function createConversationProfileBatch(
  input: typeof conversationProfileBatches.$inferInsert,
  executor: Executor,
) {
  const [batch] = await executor.insert(conversationProfileBatches).values(input)
    .onConflictDoNothing()
    .returning();
  if (batch) return batch;
  const [existing] = await executor.select().from(conversationProfileBatches).where(and(
    eq(conversationProfileBatches.eventId, input.eventId),
    eq(conversationProfileBatches.payloadDigest, input.payloadDigest),
  )).limit(1);
  return existing;
}

export async function activateConversationProfileBatch(batchId: string, eventId: string, executor: Executor) {
  const now = new Date();
  await executor.update(conversationProfileBatches).set({ status: 'superseded' })
    .where(and(
      eq(conversationProfileBatches.eventId, eventId),
      eq(conversationProfileBatches.status, 'active'),
      ne(conversationProfileBatches.id, batchId),
    ));
  const [active] = await executor.update(conversationProfileBatches).set({
    status: 'active',
    activatedAt: now,
    failureReason: null,
  }).where(and(
    eq(conversationProfileBatches.id, batchId),
    eq(conversationProfileBatches.eventId, eventId),
  )).returning();
  if (!active) throw new Error('활성화할 대화 프로필 배치를 찾지 못했습니다.');
  return active;
}

export async function previousFinalProfiles(eventId: string, executor: Executor = db) {
  const rows = await executor.select({
    sourceDigest: conversationProfiles.sourceDigest,
    profileData: conversationProfiles.profileData,
  }).from(conversationProfiles)
    .innerJoin(conversationProfileBatches, eq(conversationProfiles.batchId, conversationProfileBatches.id))
    .where(and(
      eq(conversationProfileBatches.eventId, eventId),
      eq(conversationProfileBatches.status, 'active'),
    ));
  return new Map(rows.map((row) => [row.sourceDigest, row.profileData]));
}

export async function earliestConversationProfiles(eventId: string, executor: Executor = db) {
  const rows = await executor.select({
    sourceDigest: conversationProfiles.sourceDigest,
    profileData: conversationProfiles.profileData,
  }).from(conversationProfiles)
    .innerJoin(conversationProfileBatches, eq(conversationProfiles.batchId, conversationProfileBatches.id))
    .where(eq(conversationProfileBatches.eventId, eventId))
    .orderBy(conversationProfileBatches.importedAt);
  const first = new Map<string, ConversationProfileData>();
  for (const row of rows) if (!first.has(row.sourceDigest)) first.set(row.sourceDigest, row.profileData);
  return first;
}

export async function activeConversationProfiles(eventId: string, executor: Executor = db) {
  return executor.select().from(conversationProfiles)
    .innerJoin(conversationProfileBatches, eq(conversationProfiles.batchId, conversationProfileBatches.id))
    .where(and(
      eq(conversationProfileBatches.eventId, eventId),
      eq(conversationProfileBatches.status, 'active'),
    ));
}

export async function releaseConversationProfileClaims(batchId: string, executor: Executor) {
  await executor.update(conversationProfiles).set({
    claimedParticipantId: null,
    claimedAt: null,
    updatedAt: new Date(),
  }).where(eq(conversationProfiles.batchId, batchId));
}

export async function adminConversationProfileSummary(eventId: string, executor: Executor = db) {
  const activeBatch = await findActiveConversationProfileBatch(eventId, executor);
  if (!activeBatch) return {
    activeBatch: null,
    counts: { ready: 0, claimed: 0, mergedSourceRows: 0 },
    profiles: [],
  };

  const rows = await executor.select({
    profile: conversationProfiles,
    alias: conversationProfileAliases,
  }).from(conversationProfiles)
    .innerJoin(conversationProfileAliases, eq(conversationProfileAliases.profileId, conversationProfiles.id))
    .where(eq(conversationProfiles.batchId, activeBatch.id));
  const grouped = new Map<string, {
    id: string;
    nickname: string;
    aliases: string[];
    sourceRowCount: number;
    claimed: boolean;
    generatorVersion: string;
  }>();
  for (const { profile, alias } of rows) {
    const current = grouped.get(profile.id) ?? {
      id: profile.id,
      nickname: profile.nicknameDisplay,
      aliases: [],
      sourceRowCount: profile.sourceRowCount,
      claimed: Boolean(profile.claimedParticipantId),
      generatorVersion: profile.profileData.generatorVersion,
    };
    current.aliases.push(alias.displayAlias);
    grouped.set(profile.id, current);
  }
  const profiles = [...grouped.values()].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
  return {
    activeBatch: {
      id: activeBatch.id,
      schemaVersion: activeBatch.schemaVersion,
      sourceVersion: activeBatch.sourceVersion,
      selectionMode: activeBatch.selectionMode,
      sourceUserCount: activeBatch.sourceUserCount,
      profileCount: activeBatch.profileCount,
      activatedAt: activeBatch.activatedAt,
    },
    counts: {
      ready: profiles.length,
      claimed: profiles.filter((profile) => profile.claimed).length,
      mergedSourceRows: activeBatch.mergedSourceRowCount,
    },
    profiles,
  };
}
