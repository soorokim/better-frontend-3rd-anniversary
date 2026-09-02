import { and, eq, sql } from 'drizzle-orm';
import { answers, avatarAssignments, events, participants, questions } from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';

type Executor = typeof db | Transaction;

export async function findEventBySlug(slug: string, executor: Executor = db) {
  const [event] = await executor.select().from(events).where(eq(events.slug, slug)).limit(1);
  return event;
}

export async function findParticipantByNickname(eventId: string, nicknameKey: string, executor: Executor = db) {
  const [participant] = await executor.select().from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.nicknameKey, nicknameKey))).limit(1);
  return participant;
}

export async function findParticipantById(participantId: string, executor: Executor = db) {
  const [participant] = await executor.select().from(participants)
    .where(eq(participants.id, participantId)).limit(1);
  return participant;
}

export async function findParticipantWithAvatar(participantId: string, executor: Executor = db) {
  const [row] = await executor.select({ participant: participants, avatar: avatarAssignments })
    .from(participants)
    .innerJoin(avatarAssignments, eq(participants.currentAvatarId, avatarAssignments.id))
    .where(eq(participants.id, participantId)).limit(1);
  return row;
}

export async function createParticipantWithAvatar(input: {
  eventId: string;
  nicknameDisplay: string;
  nicknameKey: string;
  nicknameRuleVersion: string;
  pinHash: string;
  avatar: {
    sourceKind: 'nickname' | 'conversation';
    sourceVersion: string;
    sourceDigest: string;
    generatorVersion: string;
    catalogVersion: string;
    traits: Record<string, string>;
    conversationProfileId?: string;
  };
}, executor: Executor) {
  const [participant] = await executor.insert(participants).values({
    eventId: input.eventId,
    nicknameDisplay: input.nicknameDisplay,
    nicknameKey: input.nicknameKey,
    nicknameRuleVersion: input.nicknameRuleVersion,
    pinHash: input.pinHash,
  }).returning();
  const [avatar] = await executor.insert(avatarAssignments).values({
    participantId: participant.id,
    sourceKind: input.avatar.sourceKind,
    sourceVersion: input.avatar.sourceVersion,
    sourceDigest: input.avatar.sourceDigest,
    generatorVersion: input.avatar.generatorVersion,
    catalogVersion: input.avatar.catalogVersion,
    selectedTraits: input.avatar.traits,
    conversationProfileId: input.avatar.conversationProfileId,
  }).returning();
  await executor.update(participants).set({ currentAvatarId: avatar.id, updatedAt: new Date() })
    .where(eq(participants.id, participant.id));
  return { participant: { ...participant, currentAvatarId: avatar.id }, avatar };
}

export async function assignConversationAvatar(input: {
  participantId: string;
  supersedesId: string;
  sourceVersion: string;
  sourceDigest: string;
  generatorVersion: string;
  catalogVersion: string;
  traits: Record<string, string>;
  conversationProfileId: string;
}, executor: Executor) {
  const [created] = await executor.insert(avatarAssignments).values({
    participantId: input.participantId,
    sourceKind: 'conversation',
    sourceVersion: input.sourceVersion,
    sourceDigest: input.sourceDigest,
    generatorVersion: input.generatorVersion,
    catalogVersion: input.catalogVersion,
    selectedTraits: input.traits,
    conversationProfileId: input.conversationProfileId,
    supersedesId: input.supersedesId,
  }).onConflictDoNothing().returning();

  const [avatar] = created ? [created] : await executor.update(avatarAssignments).set({
    sourceVersion: input.sourceVersion,
    generatorVersion: input.generatorVersion,
    catalogVersion: input.catalogVersion,
    selectedTraits: input.traits,
    conversationProfileId: input.conversationProfileId,
  }).where(and(
    eq(avatarAssignments.participantId, input.participantId),
    eq(avatarAssignments.sourceKind, 'conversation'),
    eq(avatarAssignments.sourceDigest, input.sourceDigest),
  )).returning();
  if (!avatar) throw new Error('대화 기반 캐릭터를 저장하지 못했습니다.');

  await executor.update(participants).set({ currentAvatarId: avatar.id, updatedAt: new Date() })
    .where(eq(participants.id, input.participantId));
  return avatar;
}

export async function answerStatusForParticipant(participantId: string, eventId: string, executor: Executor = db) {
  const [question] = await executor.select({ id: questions.id }).from(questions)
    .where(and(eq(questions.eventId, eventId), eq(questions.status, 'published'))).limit(1);
  if (!question) return 'question-unavailable' as const;
  const [answer] = await executor.select({ id: answers.id }).from(answers)
    .where(and(eq(answers.participantId, participantId), eq(answers.questionId, question.id))).limit(1);
  return answer ? 'submitted' as const : 'not-submitted' as const;
}

export function isNicknameConflict(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
      cause?: unknown;
    };
    const constraint = candidate.constraint_name ?? candidate.constraint;
    if (candidate.code === '23505' && (
      constraint === 'participants_event_nickname_uq'
      || constraint === 'participants_event_id_nickname_key_key'
    )) return true;
    current = candidate.cause;
  }
  return false;
}

export async function listParticipantRoster(eventId: string, executor: Executor = db) {
  return executor.select({
    id: participants.id,
    nickname: participants.nicknameDisplay,
    avatar: { generatorVersion: avatarAssignments.generatorVersion, catalogVersion: avatarAssignments.catalogVersion, traits: avatarAssignments.selectedTraits },
  }).from(participants)
    .innerJoin(avatarAssignments, eq(participants.currentAvatarId, avatarAssignments.id))
    .where(eq(participants.eventId, eventId))
    .orderBy(participants.createdAt);
}

export async function findParticipantsBySlashPrefix(eventId: string, nicknamePrefixKey: string, executor: Executor = db) {
  return executor.select({
    id: participants.id,
    nicknameDisplay: participants.nicknameDisplay,
  }).from(participants).where(and(
    eq(participants.eventId, eventId),
    sql`position('/' in ${participants.nicknameKey}) > 0`,
    sql`split_part(${participants.nicknameKey}, '/', 1) = ${nicknamePrefixKey}`,
  )).limit(3);
}
