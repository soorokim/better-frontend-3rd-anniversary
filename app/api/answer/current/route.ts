import { currentAnswer, saveAnswer, saveCurrentAnswer } from '@/lib/answers/answer-service';
import { requireParticipant } from '@/lib/auth/authorization';
import { getEnv } from '@/lib/config/env';
import { AppError, errorResponse } from '@/lib/http/errors';
import { verifyCsrf, verifyOrigin } from '@/lib/security/csrf';
import { answerRequestSchema } from '@/lib/validation/answer';

export async function GET() {
  try {
    const { participant } = await requireParticipant();
    return Response.json(await currentAnswer(participant.id, participant.eventId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { participant, session } = await requireParticipant();
    if (!verifyOrigin(request, getEnv().APP_ORIGIN)
      || !verifyCsrf(session.csrfHash, request.headers.get('x-csrf-token'))) {
      throw new AppError('csrf_error', '요청을 확인할 수 없습니다. 새로고침 뒤 다시 시도해 주세요.', 403);
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new AppError('invalid_json', '요청 내용을 확인해 주세요.', 400);
    }
    const body = answerRequestSchema.parse(payload);
    return Response.json(body.questionId
      ? await saveAnswer(participant.id, participant.eventId, body.questionId, body.content)
      : await saveCurrentAnswer(participant.id, participant.eventId, body.content));
  } catch (error) {
    return errorResponse(error);
  }
}
