import { requireParticipant } from '@/lib/auth/authorization';
import { lobbyView } from '@/lib/auth/participant-service';
import { errorResponse } from '@/lib/http/errors';

export async function GET() {
  try {
    const { participant } = await requireParticipant();
    return Response.json(await lobbyView(participant.id));
  } catch (error) {
    return errorResponse(error);
  }
}
