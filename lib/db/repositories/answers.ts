import { and, eq } from 'drizzle-orm';
import { answers } from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';

type Executor = typeof db | Transaction;

export async function findOwnedAnswer(participantId: string, questionId: string, executor: Executor = db) {
  const [answer] = await executor.select().from(answers).where(and(
    eq(answers.participantId, participantId),
    eq(answers.questionId, questionId),
  )).limit(1);
  return answer;
}

export async function upsertOwnedAnswer(input: {
  participantId: string;
  questionId: string;
  content: string;
}, executor: Executor) {
  const [answer] = await executor.insert(answers).values(input).onConflictDoUpdate({
    target: [answers.participantId, answers.questionId],
    set: { content: input.content, updatedAt: new Date() },
  }).returning();
  return answer;
}
