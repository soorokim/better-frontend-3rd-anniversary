import { and, count, eq, gt, isNull, lt, max, sql } from 'drizzle-orm';
import {
  answers,
  avatarAssignments,
  events,
  participants,
  presentationItems,
  presentationSessions,
  questions,
} from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';

type Executor = typeof db | Transaction;

const missingSessionId = '00000000-0000-0000-0000-000000000000';

export type PresentationAnswerCandidate = Awaited<ReturnType<typeof findPresentationAnswer>>;

export async function findPresentationBoundary(eventId: string, executor: Executor = db) {
  const [boundary] = await executor.select({ event: events, question: questions })
    .from(events)
    .innerJoin(questions, and(
      eq(questions.eventId, events.id),
      eq(questions.status, 'published'),
    ))
    .where(eq(events.id, eventId))
    .limit(1);
  return boundary;
}

export async function findPresentationSession(
  eventId: string,
  questionId: string,
  executor: Executor = db,
) {
  const [session] = await executor.select().from(presentationSessions).where(and(
    eq(presentationSessions.eventId, eventId),
    eq(presentationSessions.questionId, questionId),
  )).limit(1);
  return session;
}

export async function preparePresentationSession(eventId: string, executor: Executor = db) {
  const boundary = await findPresentationBoundary(eventId, executor);
  if (!boundary) return undefined;

  await executor.insert(presentationSessions).values({
    eventId: boundary.event.id,
    questionId: boundary.question.id,
  }).onConflictDoNothing({ target: presentationSessions.questionId });

  const session = await findPresentationSession(
    boundary.event.id,
    boundary.question.id,
    executor,
  );
  if (!session) throw new Error('발표 세션을 준비하지 못했습니다.');
  return { ...boundary, session };
}

export async function lockPresentationSession(sessionId: string, executor: Transaction) {
  const [session] = await executor.select().from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId))
    .for('update')
    .limit(1);
  return session;
}

export async function incrementPresentationRevision(sessionId: string, executor: Transaction) {
  const [session] = await executor.update(presentationSessions).set({
    revision: sql`${presentationSessions.revision} + 1`,
    updatedAt: new Date(),
  }).where(eq(presentationSessions.id, sessionId)).returning();
  return session;
}

export async function findPresentationAnswer(
  eventId: string,
  questionId: string,
  answerId: string,
  executor: Executor = db,
) {
  const [candidate] = await executor.select({
    id: answers.id,
    content: answers.content,
    submittedAt: answers.submittedAt,
    updatedAt: answers.updatedAt,
    nickname: participants.nicknameDisplay,
    avatar: {
      generatorVersion: avatarAssignments.generatorVersion,
      catalogVersion: avatarAssignments.catalogVersion,
      traits: avatarAssignments.selectedTraits,
    },
  }).from(answers)
    .innerJoin(participants, and(
      eq(participants.id, answers.participantId),
      eq(participants.eventId, eventId),
    ))
    .innerJoin(avatarAssignments, eq(avatarAssignments.id, participants.currentAvatarId))
    .where(and(eq(answers.id, answerId), eq(answers.questionId, questionId)))
    .limit(1);
  return candidate;
}

export async function findRandomUnpresentedAnswer(
  eventId: string,
  questionId: string,
  sessionId: string,
  executor: Transaction,
) {
  const [candidate] = await executor.select({
    id: answers.id,
    content: answers.content,
    submittedAt: answers.submittedAt,
    updatedAt: answers.updatedAt,
    nickname: participants.nicknameDisplay,
    avatar: {
      generatorVersion: avatarAssignments.generatorVersion,
      catalogVersion: avatarAssignments.catalogVersion,
      traits: avatarAssignments.selectedTraits,
    },
  }).from(answers)
    .innerJoin(participants, and(
      eq(participants.id, answers.participantId),
      eq(participants.eventId, eventId),
    ))
    .innerJoin(avatarAssignments, eq(avatarAssignments.id, participants.currentAvatarId))
    .leftJoin(presentationItems, and(
      eq(presentationItems.presentationSessionId, sessionId),
      eq(presentationItems.answerId, answers.id),
    ))
    .where(and(
      eq(answers.questionId, questionId),
      isNull(presentationItems.id),
    ))
    .orderBy(sql`random()`)
    .limit(1);
  return candidate;
}

export async function nextPresentationOrder(sessionId: string, executor: Transaction) {
  const [row] = await executor.select({ value: max(presentationItems.presentationOrder) })
    .from(presentationItems)
    .where(eq(presentationItems.presentationSessionId, sessionId));
  return (row?.value ?? 0) + 1;
}

export async function savePresentationItem(input: {
  sessionId: string;
  candidate: NonNullable<PresentationAnswerCandidate>;
  presentationOrder: number;
}, executor: Transaction) {
  const now = new Date();
  const [item] = await executor.insert(presentationItems).values({
    presentationSessionId: input.sessionId,
    answerId: input.candidate.id,
    contentSnapshot: input.candidate.content,
    answerUpdatedAtSnapshot: input.candidate.updatedAt,
    nicknameSnapshot: input.candidate.nickname,
    avatarSnapshot: input.candidate.avatar,
    presentationOrder: input.presentationOrder,
    lastSelectedAt: now,
  }).onConflictDoUpdate({
    target: [presentationItems.presentationSessionId, presentationItems.answerId],
    set: {
      contentSnapshot: input.candidate.content,
      answerUpdatedAtSnapshot: input.candidate.updatedAt,
      nicknameSnapshot: input.candidate.nickname,
      avatarSnapshot: input.candidate.avatar,
      lastSelectedAt: now,
    },
  }).returning();
  return item;
}

export async function updatePresentationSession(input: {
  sessionId: string;
  currentItemId?: string | null;
  authorRevealed?: boolean;
}, executor: Transaction) {
  const [session] = await executor.update(presentationSessions).set({
    ...(input.currentItemId === undefined ? {} : { currentItemId: input.currentItemId }),
    ...(input.authorRevealed === undefined ? {} : { authorRevealed: input.authorRevealed }),
    revision: sql`${presentationSessions.revision} + 1`,
    updatedAt: new Date(),
  }).where(eq(presentationSessions.id, input.sessionId)).returning();
  return session;
}

export async function findAdjacentPresentationItem(input: {
  sessionId: string;
  currentItemId: string;
  direction: 'previous' | 'next';
}, executor: Transaction) {
  const [current] = await executor.select({
    presentationOrder: presentationItems.presentationOrder,
  }).from(presentationItems).where(and(
    eq(presentationItems.id, input.currentItemId),
    eq(presentationItems.presentationSessionId, input.sessionId),
  )).limit(1);
  if (!current) return undefined;

  const isPrevious = input.direction === 'previous';
  const [item] = await executor.select().from(presentationItems).where(and(
    eq(presentationItems.presentationSessionId, input.sessionId),
    isPrevious
      ? lt(presentationItems.presentationOrder, current.presentationOrder)
      : gt(presentationItems.presentationOrder, current.presentationOrder),
  )).orderBy(isPrevious
    ? sql`${presentationItems.presentationOrder} desc`
    : presentationItems.presentationOrder)
    .limit(1);
  return item;
}

export async function restartPresentationSession(sessionId: string, executor: Transaction) {
  const [session] = await executor.update(presentationSessions).set({
    currentItemId: null,
    authorRevealed: false,
    revision: sql`${presentationSessions.revision} + 1`,
    updatedAt: new Date(),
  }).where(eq(presentationSessions.id, sessionId)).returning();
  if (!session) return undefined;

  await executor.delete(presentationItems)
    .where(eq(presentationItems.presentationSessionId, sessionId));
  return session;
}

export async function getPresentationControllerData(eventId: string, executor: Executor = db) {
  const boundary = await findPresentationBoundary(eventId, executor);
  if (!boundary) return undefined;

  const session = await findPresentationSession(eventId, boundary.question.id, executor);
  const sessionId = session?.id ?? missingSessionId;
  const [[participantTotal], answerRows, currentRows] = await Promise.all([
    executor.select({ value: count() }).from(participants).where(eq(participants.eventId, eventId)),
    executor.select({
      id: answers.id,
      content: answers.content,
      submittedAt: answers.submittedAt,
      updatedAt: answers.updatedAt,
      nickname: participants.nicknameDisplay,
      avatar: {
        generatorVersion: avatarAssignments.generatorVersion,
        catalogVersion: avatarAssignments.catalogVersion,
        traits: avatarAssignments.selectedTraits,
      },
      presentationItemId: presentationItems.id,
      presentationOrder: presentationItems.presentationOrder,
    }).from(answers)
      .innerJoin(participants, and(
        eq(participants.id, answers.participantId),
        eq(participants.eventId, eventId),
      ))
      .innerJoin(avatarAssignments, eq(avatarAssignments.id, participants.currentAvatarId))
      .leftJoin(presentationItems, and(
        eq(presentationItems.presentationSessionId, sessionId),
        eq(presentationItems.answerId, answers.id),
      ))
      .where(eq(answers.questionId, boundary.question.id))
      .orderBy(answers.submittedAt, answers.id),
    session?.currentItemId
      ? executor.select({
        itemId: presentationItems.id,
        answerId: presentationItems.answerId,
        content: presentationItems.contentSnapshot,
        nickname: presentationItems.nicknameSnapshot,
        avatar: presentationItems.avatarSnapshot,
        presentationOrder: presentationItems.presentationOrder,
      }).from(presentationItems).where(and(
        eq(presentationItems.id, session.currentItemId),
        eq(presentationItems.presentationSessionId, session.id),
      )).limit(1)
      : Promise.resolve([]),
  ]);

  return {
    question: { id: boundary.question.id, prompt: boundary.question.prompt },
    participantCount: participantTotal?.value ?? 0,
    session: session ? {
      revision: session.revision,
      currentItemId: session.currentItemId,
      authorRevealed: session.authorRevealed,
      updatedAt: session.updatedAt,
    } : null,
    currentSlide: currentRows[0] ?? null,
    answers: answerRows,
  };
}
