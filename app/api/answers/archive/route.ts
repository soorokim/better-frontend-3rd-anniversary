import { requireParticipant } from '@/lib/auth/authorization';
import { participantArchive } from '@/lib/answers/archive-service';
import { errorResponse } from '@/lib/http/errors';

export async function GET() {
  try {
    const { participant } = await requireParticipant();
    return Response.json(await participantArchive(participant.eventId), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return errorResponse(error); }
}
