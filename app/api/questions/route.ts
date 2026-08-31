import { requireParticipant } from '@/lib/auth/authorization';
import { errorResponse } from '@/lib/http/errors';
import { answerableQuestions } from '@/lib/questions/question-service';

export async function GET() {
  try {
    const { participant } = await requireParticipant();
    return Response.json(await answerableQuestions(participant.eventId), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    return errorResponse(error);
  }
}
