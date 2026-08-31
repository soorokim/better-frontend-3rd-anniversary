import { and, eq } from 'drizzle-orm';
import { auditEvents, conversationProfiles, participants } from '@/db/schema';
import { createAuditEvent } from '@/lib/db/repositories/audit';
import { inTransaction } from '@/lib/db/transaction';
import { AppError } from '@/lib/http/errors';

export async function deleteParticipantAccount(input: {
  adminId: string;
  eventId: string;
  participantId: string;
}) {
  await inTransaction(async (tx) => {
    const [participant] = await tx.select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.id, input.participantId), eq(participants.eventId, input.eventId)))
      .for('update')
      .limit(1);
    if (!participant) throw new AppError('participant_not_found', '참가자를 찾을 수 없습니다.', 404);

    // Break the circular current-avatar reference before participant-owned rows cascade.
    await tx.update(participants)
      .set({ currentAvatarId: null, updatedAt: new Date() })
      .where(eq(participants.id, participant.id));
    await tx.update(conversationProfiles)
      .set({ claimedParticipantId: null, claimedAt: null, updatedAt: new Date() })
      .where(eq(conversationProfiles.claimedParticipantId, participant.id));
    await tx.update(auditEvents)
      .set({ targetParticipantId: null })
      .where(eq(auditEvents.targetParticipantId, participant.id));

    const [deleted] = await tx.delete(participants)
      .where(and(eq(participants.id, participant.id), eq(participants.eventId, input.eventId)))
      .returning({ id: participants.id });
    if (!deleted) throw new AppError('participant_not_found', '참가자를 찾을 수 없습니다.', 404);
    await createAuditEvent({
      eventId: input.eventId,
      adminId: input.adminId,
      action: 'participant_deleted',
      outcome: 'success',
    }, tx);
  });
}
