import { and, asc, eq } from 'drizzle-orm';
import { questions } from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';

type Executor = typeof db | Transaction;

export async function findPublishedQuestion(eventId: string, executor: Executor = db, lock = false) {
  const query = executor.select().from(questions).where(and(
    eq(questions.eventId, eventId),
    eq(questions.status, 'published'),
  )).limit(1);
  const rows = lock && 'for' in query ? await query.for('update') : await query;
  return rows[0];
}

export async function findAnswerableQuestions(eventId: string, executor: Executor = db) {
  return executor.select().from(questions).where(and(
    eq(questions.eventId, eventId),
    eq(questions.status, 'published'),
  )).orderBy(asc(questions.displayOrder));
}
