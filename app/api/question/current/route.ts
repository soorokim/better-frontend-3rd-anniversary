import { requireParticipant } from '@/lib/auth/authorization';
import { errorResponse } from '@/lib/http/errors';
import { currentQuestion } from '@/lib/questions/question-service';

export async function GET() {
  try {
    const { participant } = await requireParticipant();
    return Response.json(await currentQuestion(participant.eventId));
  } catch (error) {
    return errorResponse(error);
  }
}
