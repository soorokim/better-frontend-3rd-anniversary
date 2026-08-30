import { and, eq } from 'drizzle-orm';
import { answers, avatarAssignments, events, participants, questions } from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';
import type { AvatarTraits } from '@/lib/avatar/catalog';

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
    sourceDigest: string;
    generatorVersion: string;
    catalogVersion: string;
    traits: AvatarTraits;
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
    sourceKind: 'nickname',
    sourceVersion: input.nicknameRuleVersion,
    sourceDigest: input.avatar.sourceDigest,
    generatorVersion: input.avatar.generatorVersion,
    catalogVersion: input.avatar.catalogVersion,
    selectedTraits: input.avatar.traits,
  }).returning();
  await executor.update(participants).set({ currentAvatarId: avatar.id, updatedAt: new Date() })
    .where(eq(participants.id, participant.id));
  return { participant: { ...participant, currentAvatarId: avatar.id }, avatar };
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
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; constraint_name?: string; constraint?: string };
  return candidate.code === '23505'
    && (candidate.constraint_name === 'participants_event_nickname_uq'
      || candidate.constraint === 'participants_event_nickname_uq');
}
