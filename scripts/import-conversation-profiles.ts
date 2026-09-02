import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { conversationProfileAliases, conversationProfiles } from '@/db/schema';
import { allocateDeveloperProfiles, DEVELOPER_PROFILE_VERSION, type DeveloperProfile } from '@/lib/avatar/developer-profile';
import { closeDatabase } from '@/lib/db/client';
import {
  activateConversationProfileBatch,
  activeConversationProfiles,
  createConversationProfileBatch,
  earliestConversationProfiles,
  releaseConversationProfileClaims,
} from '@/lib/db/repositories/conversation-profiles';
import { findEventBySlug } from '@/lib/db/repositories/participants';
import { inTransaction } from '@/lib/db/transaction';
import { cleanConversationAnalysisSchema } from '@/lib/validation/conversation-profile';
import { normalizeNickname } from '@/lib/validation/nickname';

export const CONVERSATION_SOURCE_VERSION = 'kakao-conversation-v1';

function previousDeveloperProfile(value: import('@/db/schema').ConversationProfileData): DeveloperProfile {
  return {
    selectedAdjective: value.selectedAdjective,
    selectedNoun: value.selectedNoun,
    className: value.className,
    item: value.item,
    itemReason: value.itemReason ?? '',
    defaultStatus: value.defaultStatus,
    easterEggStatuses: value.easterEggStatuses,
    displayHash: value.displayHash,
    generatorVersion: value.generatorVersion,
    avatarSeed: value.avatarSeed,
    avatarOptions: value.avatarOptions,
  };
}

export async function importConversationProfiles(path: string) {
  const raw = await readFile(resolve(path), 'utf8');
  const payload = cleanConversationAnalysisSchema.parse(JSON.parse(raw));
  // A rule version is part of the derived profile. This permits a reviewed
  // re-import after the derivation rules change, while identical imports stay idempotent.
  const payloadDigest = createHash('sha256').update(`${DEVELOPER_PROFILE_VERSION}\0${raw}`, 'utf8').digest('hex');
  const eventSlug = process.env.EVENT_SLUG ?? 'frontend-chat-3rd';
  const event = await findEventBySlug(eventSlug);
  if (!event) throw new Error(`행사를 찾지 못했습니다: ${eventSlug}`);

  const normalized = payload.profiles.map((profile) => ({
    profile,
    nickname: normalizeNickname(profile.name),
    aliases: [...new Map([profile.name, ...profile.source_aliases].map((displayAlias) => {
      const alias = normalizeNickname(displayAlias);
      return [alias.key, { displayAlias: alias.display, aliasKey: alias.key }];
    })).values()],
  }));
  const aliasOwners = new Map<string, string>();
  for (const entry of normalized) {
    for (const alias of entry.aliases) {
      const owner = aliasOwners.get(alias.aliasKey);
      if (owner && owner !== entry.nickname.key) throw new Error(`승인 별칭 충돌: ${alias.displayAlias}`);
      aliasOwners.set(alias.aliasKey, entry.nickname.key);
    }
  }

  const previousRows = await activeConversationProfiles(event.id);
  const historicalProfiles = await earliestConversationProfiles(event.id);
  const previousProfiles = new Map([...historicalProfiles].map(([digest, profile]) => [digest, previousDeveloperProfile(profile)]));
  const previousByDigest = new Map(previousRows.map(({ conversation_profiles: profile }) => [profile.sourceDigest, profile]));
  const previousByNickname = new Map(previousRows.map(({ conversation_profiles: profile }) => [profile.nicknameKey, profile]));
  const allocated = allocateDeveloperProfiles(payload.profiles.map((profile) => ({
    sourceVersion: CONVERSATION_SOURCE_VERSION,
    sourceDigest: profile.conversation_digest,
    adjectiveCandidates: profile.adjective_candidates,
    nounCandidates: profile.noun_candidates,
    signals: profile.signals,
    topicRates: profile.topic_rates_per_10k_chars,
  })), previousProfiles);
  const mergedSourceRowCount = payload.profiles.reduce(
    (sum, profile) => sum + (profile.source_row_count > 1 ? profile.source_row_count : 0),
    0,
  );

  return inTransaction(async (tx) => {
    const batch = await createConversationProfileBatch({
      eventId: event.id,
      schemaVersion: payload.schema_version,
      sourceVersion: CONVERSATION_SOURCE_VERSION,
      selectionMode: payload.selection,
      sourceUserCount: payload.source_user_count,
      profileCount: payload.profiles.length,
      mergedSourceRowCount,
      payloadDigest,
      status: 'staged',
    }, tx);
    if (!batch) throw new Error('대화 프로필 배치를 만들지 못했습니다.');
    if (batch.status === 'active') {
      return { imported: 0, stored: batch.profileCount, event: event.slug, batchId: batch.id, idempotent: true };
    }
    if (batch.status !== 'staged') throw new Error('같은 파일의 실패한 배치가 남아 있습니다. 운영자 확인이 필요합니다.');
    const priorActiveBatchId = previousRows[0]?.conversation_profile_batches.id;
    if (priorActiveBatchId) await releaseConversationProfileClaims(priorActiveBatchId, tx);

    for (const entry of normalized) {
      const profileData = allocated.get(entry.profile.conversation_digest);
      if (!profileData) throw new Error('확정 개발자 프로필을 만들지 못했습니다.');
      const [stored] = await tx.insert(conversationProfiles).values({
        batchId: batch.id,
        eventId: event.id,
        nicknameDisplay: entry.nickname.display,
        nicknameKey: entry.nickname.key,
        sourceVersion: CONVERSATION_SOURCE_VERSION,
        sourceDigest: entry.profile.conversation_digest,
        sourceRowCount: entry.profile.source_row_count,
        profileData,
        claimedParticipantId: (previousByDigest.get(entry.profile.conversation_digest)
          ?? previousByNickname.get(entry.nickname.key))?.claimedParticipantId,
        claimedAt: (previousByDigest.get(entry.profile.conversation_digest)
          ?? previousByNickname.get(entry.nickname.key))?.claimedAt,
      }).returning();
      if (!stored) throw new Error('대화 프로필 저장에 실패했습니다.');
      await tx.insert(conversationProfileAliases).values(entry.aliases.map((alias) => ({
        batchId: batch.id,
        profileId: stored.id,
        displayAlias: alias.displayAlias,
        aliasKey: alias.aliasKey,
        kind: alias.aliasKey === entry.nickname.key
          ? 'canonical' as const
          : entry.profile.source_row_count > 1 ? 'approved_alias' as const : 'discovered' as const,
      })));
    }
    const active = await activateConversationProfileBatch(batch.id, event.id, tx);
    return { imported: payload.profiles.length, stored: payload.profiles.length, event: event.slug, batchId: active.id, idempotent: false };
  });
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('사용법: npm run avatar:import -- <profiles.json>');
  const result = await importConversationProfiles(path);
  console.log(result.idempotent
    ? `이미 활성화된 배치입니다: ${result.batchId}`
    : `대화 프로필 ${result.imported}개를 ${result.event} 행사에 원자적으로 활성화했습니다. (${result.batchId})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : '대화 프로필 가져오기에 실패했습니다.');
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
