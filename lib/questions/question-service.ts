import { findAnswerableQuestions, findPublishedQuestion } from '@/lib/db/repositories/questions';
import { AppError } from '@/lib/http/errors';

export type QuestionView = {
  id: string;
  prompt: string;
  status: 'published';
};

export async function currentQuestion(eventId: string): Promise<QuestionView> {
  const question = await findPublishedQuestion(eventId);
  if (!question) throw new AppError('question_unavailable', '아직 공개된 3주년 질문이 없습니다.', 404);
  return { id: question.id, prompt: question.prompt, status: 'published' };
}

export async function answerableQuestions(eventId: string): Promise<QuestionView[]> {
  const rows = await findAnswerableQuestions(eventId);
  if (!rows.length) throw new AppError('question_unavailable', '아직 답변할 수 있는 질문이 없습니다.', 404);
  return rows.map((question) => ({ id: question.id, prompt: question.prompt, status: 'published' }));
}
