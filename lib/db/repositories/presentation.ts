import { and, asc, count, eq, gt, isNull, lt, max, sql } from 'drizzle-orm';
import {
  answers,
  avatarAssignments,
  events,
  participants,
  presentationItems,
  presentationSessions,
  questionSequenceSessions,
  questions,
} from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';

type Executor = typeof db | Transaction;

const missingSessionId = '00000000-0000-0000-0000-000000000000';

export type PresentationAnswerCandidate = Awaited<ReturnType<typeof findPresentationAnswer>>;

export async function findPresentationBoundary(eventId: string, executor: Executor = db) {
  const [sequence] = await executor.select().from(questionSequenceSessions).where(eq(questionSequenceSessions.eventId, eventId)).limit(1);
  const [event] = await executor.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return undefined;
  const [question] = sequence.currentQuestionId
    ? await executor.select().from(questions).where(eq(questions.id, sequence.currentQuestionId)).limit(1)
    : await executor.select().from(questions).where(eq(questions.eventId, eventId)).orderBy(asc(questions.displayOrder)).limit(1);
  return question ? { event, question } : undefined;
}

export async function getOrCreateSequence(eventId: string, executor: Executor = db) {
  await executor.insert(questionSequenceSessions).values({ eventId }).onConflictDoNothing({ target: questionSequenceSessions.eventId });
  const [sequence] = await executor.select().from(questionSequenceSessions).where(eq(questionSequenceSessions.eventId, eventId)).limit(1);
  return sequence;
}

export async function lockSequence(eventId: string, executor: Transaction) {
  const sequence = await getOrCreateSequence(eventId, executor);
  if (!sequence) return undefined;
  const [locked] = await executor.select().from(questionSequenceSessions).where(eq(questionSequenceSessions.id, sequence.id)).for('update').limit(1);
  return locked;
}

export async function moveToNextQuestion(eventId: string, executor: Transaction) {
  const sequence = await lockSequence(eventId, executor);
  if (!sequence) return undefined;
  const all = await executor.select().from(questions).where(eq(questions.eventId, eventId)).orderBy(asc(questions.displayOrder));
  const currentOrder = sequence.currentQuestionId ? all.find((question) => question.id === sequence.currentQuestionId)?.displayOrder ?? 0 : 0;
  const next = all.find((question) => question.displayOrder > currentOrder);
  const [updated] = await executor.update(questionSequenceSessions).set({
    currentQuestionId: next?.id ?? sequence.currentQuestionId,
    status: next ? 'in_progress' : 'completed',
    completedAt: next ? null : new Date(),
    revision: sql`${questionSequenceSessions.revision} + 1`, updatedAt: new Date(),
  }).where(eq(questionSequenceSessions.id, sequence.id)).returning();
  return { sequence: updated, question: next };
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
  const sequence = await getOrCreateSequence(eventId, executor);
  if (sequence && !sequence.currentQuestionId) {
    const [firstQuestion] = await executor.select().from(questions).where(eq(questions.eventId, eventId))
      .orderBy(asc(questions.displayOrder)).limit(1);
    if (firstQuestion) await executor.update(questionSequenceSessions).set({
      currentQuestionId: firstQuestion.id, status: 'in_progress', revision: sql`${questionSequenceSessions.revision} + 1`, updatedAt: new Date(),
    }).where(eq(questionSequenceSessions.id, sequence.id));
  }
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

export async function completePresentationItem(itemId: string, state: 'revealed' | 'excluded', executor: Transaction) {
  const [item] = await executor.update(presentationItems).set({ completionState: state, completedAt: new Date() })
    .where(eq(presentationItems.id, itemId)).returning();
  return item;
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
