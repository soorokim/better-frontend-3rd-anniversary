import {
  findAdjacentPresentationItem,
  findPresentationAnswer,
  findRandomUnpresentedAnswer,
  getPresentationControllerData,
  lockPresentationSession,
  nextPresentationOrder,
  preparePresentationSession,
  restartPresentationSession,
  savePresentationItem,
  updatePresentationSession,
  completePresentationItem,
  moveToNextQuestion,
} from '@/lib/db/repositories/presentation';
import { inTransaction, type Transaction } from '@/lib/db/transaction';
import { AppError } from '@/lib/http/errors';
import { buildPresentationControllerView, buildPresentationScreenView } from './presentation-view';
import type { PresentationCommand } from '@/lib/validation/presentation';

const questionUnavailable = () => new AppError(
  'question_unavailable',
  '현재 발표할 질문이 없습니다.',
  404,
);

const noCurrentAnswer = () => new AppError(
  'no_current_answer',
  '현재 공개 중인 답변이 없습니다.',
  409,
);

async function controllerView(eventId: string, executor?: Transaction) {
  const data = await getPresentationControllerData(eventId, executor);
  if (!data) throw questionUnavailable();
  return buildPresentationControllerView(data);
}

export async function getPresentationController(eventId: string) {
  return inTransaction(
    (executor) => controllerView(eventId, executor),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

export async function getPresentationScreen(eventId: string) {
  return buildPresentationScreenView(await getPresentationController(eventId));
}

async function selectAnswer(input: {
  eventId: string;
  sessionId: string;
  questionId: string;
  answerId?: string;
}, executor: Transaction) {
  const existing = await lockPresentationSession(input.sessionId, executor);
  if (existing?.currentItemId && !existing.authorRevealed) {
    throw new AppError('author_not_revealed', '작성자를 공개한 뒤 다음 답변으로 넘어갈 수 있습니다.', 409);
  }
  const candidate = input.answerId
    ? await findPresentationAnswer(input.eventId, input.questionId, input.answerId, executor)
    : await findRandomUnpresentedAnswer(
      input.eventId,
      input.questionId,
      input.sessionId,
      executor,
    );

  if (!candidate) {
    if (input.answerId) {
      throw new AppError('answer_not_found', '발표할 답변을 찾을 수 없습니다.', 404, 'answerId');
    }
    throw new AppError('all_answers_presented', '아직 공개하지 않은 답변이 없습니다.', 409);
  }

  const item = await savePresentationItem({
    sessionId: input.sessionId,
    candidate,
    presentationOrder: await nextPresentationOrder(input.sessionId, executor),
  }, executor);
  if (!item) throw new Error('발표 항목을 저장하지 못했습니다.');

  await updatePresentationSession({
    sessionId: input.sessionId,
    currentItemId: item.id,
    authorRevealed: false,
  }, executor);
}

export async function commandPresentation(eventId: string, command: PresentationCommand) {
  return inTransaction(async (executor) => {
    const prepared = await preparePresentationSession(eventId, executor);
    if (!prepared) throw questionUnavailable();

    const session = await lockPresentationSession(prepared.session.id, executor);
    if (!session) throw questionUnavailable();

    switch (command.type) {
      case 'advance_question': {
        if (session.currentItemId && !session.authorRevealed) {
          throw new AppError('author_not_revealed', '작성자를 공개한 뒤 다음 질문으로 넘어갈 수 있습니다.', 409);
        }
        const current = await controllerView(eventId, executor);
        if (current.answers.length > 0 && !current.session.allPresented) {
          throw new AppError('answers_remaining', '현재 질문의 답변을 모두 공개한 뒤 다음 질문으로 넘어갈 수 있습니다.', 409);
        }
        const moved = await moveToNextQuestion(eventId, executor);
        if (!moved) throw questionUnavailable();
        return controllerView(eventId, executor);
      }
      case 'select_answer':
        await selectAnswer({
          eventId,
          sessionId: session.id,
          questionId: session.questionId,
          answerId: command.answerId,
        }, executor);
        break;
      case 'select_random':
        await selectAnswer({
          eventId,
          sessionId: session.id,
          questionId: session.questionId,
        }, executor);
        break;
      case 'set_author_visibility':
        if (!session.currentItemId) throw noCurrentAnswer();
        if (command.revealed) await completePresentationItem(session.currentItemId, 'revealed', executor);
        await updatePresentationSession({
          sessionId: session.id,
          authorRevealed: command.revealed,
        }, executor);
        break;
      case 'navigate': {
        if (!session.currentItemId) throw noCurrentAnswer();
        const target = await findAdjacentPresentationItem({
          sessionId: session.id,
          currentItemId: session.currentItemId,
          direction: command.direction,
        }, executor);
        if (!target) {
          throw new AppError(
            'navigation_boundary',
            command.direction === 'previous'
              ? '첫 번째 답변입니다.'
              : '마지막 답변입니다.',
            409,
            'direction',
          );
        }
        await updatePresentationSession({
          sessionId: session.id,
          currentItemId: target.id,
          authorRevealed: false,
        }, executor);
        break;
      }
      case 'restart':
        if (!await restartPresentationSession(session.id, executor)) {
          throw questionUnavailable();
        }
        break;
    }

    return controllerView(eventId, executor);
  });
}
