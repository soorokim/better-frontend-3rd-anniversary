import { findOwnedAnswer, upsertOwnedAnswer } from '@/lib/db/repositories/answers';
import { findPublishedQuestion } from '@/lib/db/repositories/questions';
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
  const validated = answerSchema.parse(content);
  return inTransaction(async (tx) => {
    // Locking the published row makes closing a question and saving an answer
    // occur in one clear order instead of accepting a write after closure.
    const question = await findPublishedQuestion(eventId, tx, true);
    if (!question) throw new AppError('question_unavailable', '질문이 닫혔거나 아직 공개되지 않았습니다.', 409);
    const answer = await upsertOwnedAnswer({ participantId, questionId: question.id, content: validated }, tx);
    return answerView(answer);
  });
}
