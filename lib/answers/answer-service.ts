import { findOwnedAnswer, upsertOwnedAnswer } from '@/lib/db/repositories/answers';
import { findAnswerableQuestions, findPublishedQuestion } from '@/lib/db/repositories/questions';
import { questionSequenceSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { inTransaction } from '@/lib/db/transaction';
import { AppError } from '@/lib/http/errors';
import { answerSchema } from '@/lib/validation/answer';

type Answer = NonNullable<Awaited<ReturnType<typeof findOwnedAnswer>>>;
export type AnswerView = {
  id: string;
  questionId: string;
  content: string;
  submittedAt: string;
  updatedAt: string;
};

function answerView(answer: Answer): AnswerView {
  return {
    id: answer.id,
    questionId: answer.questionId,
    content: answer.content,
    submittedAt: answer.submittedAt.toISOString(),
    updatedAt: answer.updatedAt.toISOString(),
  };
}

export async function currentAnswer(participantId: string, eventId: string): Promise<AnswerView> {
  const question = await findPublishedQuestion(eventId);
  if (!question) throw new AppError('question_unavailable', '현재 답변할 수 있는 질문이 없습니다.', 404);
  const answer = await findOwnedAnswer(participantId, question.id);
  if (!answer) throw new AppError('answer_not_found', '아직 저장한 답변이 없습니다.', 404);
  return answerView(answer);
}

export async function saveCurrentAnswer(participantId: string, eventId: string, content: unknown): Promise<AnswerView> {
  const question = await findPublishedQuestion(eventId);
  if (!question) throw new AppError('question_unavailable', '질문이 닫혔거나 아직 공개되지 않았습니다.', 409);
  return saveAnswer(participantId, eventId, question.id, content);
}

export async function saveAnswer(participantId: string, eventId: string, questionId: string, content: unknown): Promise<AnswerView> {
  const validated = answerSchema.parse(content);
  return inTransaction(async (tx) => {
    const [sequence] = await tx.select().from(questionSequenceSessions)
      .where(eq(questionSequenceSessions.eventId, eventId)).limit(1);
    if (sequence && sequence.status !== 'waiting') {
      throw new AppError('answers_closed', '행사가 시작되어 답변을 더 이상 수정할 수 없습니다.', 409);
    }
    const questions = await findAnswerableQuestions(eventId, tx);
    if (!questions.some((question) => question.id === questionId)) throw new AppError('question_unavailable', '답변할 수 없는 질문입니다.', 409);
    return answerView(await upsertOwnedAnswer({ participantId, questionId, content: validated }, tx));
  });
}
