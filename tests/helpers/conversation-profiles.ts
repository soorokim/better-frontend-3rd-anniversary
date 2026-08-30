import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  conversationProfileAliases,
  conversationProfileBatches,
  conversationProfiles,
  type ConversationProfileData,
} from '@/db/schema';
import { allocateDeveloperProfiles } from '@/lib/avatar/developer-profile';
import { normalizeNickname } from '@/lib/validation/nickname';

type Database = PostgresJsDatabase<typeof import('@/db/schema')>;

export async function conversationProfileBatchFactory(
  db: Database,
  eventId: string,
  inputs: Array<{ nickname: string; aliases?: string[]; digest?: string; sourceRowCount?: number }> = [{ nickname: '프론트' }],
  status: 'staged' | 'active' | 'superseded' | 'failed' = 'active',
) {
  const prepared = inputs.map((input, index) => ({
    ...input,
    digest: input.digest ?? String(index + 1).padStart(64, '0'),
    normalized: normalizeNickname(input.nickname),
  }));
  const finalProfiles = allocateDeveloperProfiles(prepared.map((input) => ({
    sourceVersion: 'kakao-conversation-v1',
    sourceDigest: input.digest,
    adjectiveCandidates: ['꾸준한', '호기심 많은'],
    nounCandidates: ['타입 수호자', '버그 사냥꾼'],
    signals: { volume: .5 },
  })));
  const sourceUserCount = prepared.reduce((sum, input) => sum + (input.sourceRowCount ?? 1), 0);
  const [batch] = await db.insert(conversationProfileBatches).values({
    eventId,
    schemaVersion: 'kakao-profile-analysis-v1',
    sourceVersion: 'kakao-conversation-v1',
    selectionMode: 'all-non-system-message-authors',
    sourceUserCount,
    profileCount: prepared.length,
    mergedSourceRowCount: prepared.reduce((sum, input) => sum + ((input.sourceRowCount ?? 1) > 1 ? input.sourceRowCount ?? 1 : 0), 0),
    payloadDigest: crypto.randomUUID().replaceAll('-', '').padEnd(64, '0'),
    status,
    activatedAt: status === 'active' ? new Date() : null,
  }).returning();
  const profiles = [];
  for (const input of prepared) {
    const profileData = finalProfiles.get(input.digest) as ConversationProfileData;
    const [profile] = await db.insert(conversationProfiles).values({
      batchId: batch.id,
      eventId,
      nicknameDisplay: input.normalized.display,
      nicknameKey: input.normalized.key,
      sourceVersion: 'kakao-conversation-v1',
      sourceDigest: input.digest,
      sourceRowCount: input.sourceRowCount ?? 1,
      profileData,
    }).returning();
    const aliases = [...new Set([input.nickname, ...(input.aliases ?? [])])];
    await db.insert(conversationProfileAliases).values(aliases.map((displayAlias, index) => ({
      batchId: batch.id,
      profileId: profile.id,
      displayAlias,
      aliasKey: normalizeNickname(displayAlias).key,
      kind: index === 0 ? 'canonical' as const : 'approved_alias' as const,
    })));
    profiles.push(profile);
  }
  return { batch, profiles };
}
