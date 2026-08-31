import { requireAdmin } from '@/lib/auth/authorization';
import { requireRecentAdminAuthentication } from '@/lib/auth/admin-service';
import { deleteParticipantAccount } from '@/lib/auth/participant-delete-service';
import { getEnv } from '@/lib/config/env';
import { createAuditEvent } from '@/lib/db/repositories/audit';
import { AppError, errorResponse } from '@/lib/http/errors';
import { verifyCsrf, verifyOrigin } from '@/lib/security/csrf';
import { adminReauthenticationSchema } from '@/lib/validation/auth';

export async function DELETE(request: Request, context: { params: Promise<{ participantId: string }> }) {
  let auditContext: { eventId: string; adminId: string } | undefined;
  try {
    const { admin, session } = await requireAdmin();
    auditContext = { eventId: admin.eventId, adminId: admin.id };
    if (!verifyOrigin(request, getEnv().APP_ORIGIN) || !verifyCsrf(session.csrfHash, request.headers.get('x-csrf-token'))) {
      throw new AppError('csrf_error', '요청을 확인할 수 없습니다. 새로고침 뒤 다시 시도해 주세요.', 403);
    }
    const input = adminReauthenticationSchema.parse(await request.json());
    await requireRecentAdminAuthentication(admin, session, input.password);
    const { participantId } = await context.params;
    await deleteParticipantAccount({ adminId: admin.id, eventId: admin.eventId, participantId });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (auditContext) {
      await createAuditEvent({ ...auditContext, action: 'participant_deleted', outcome: 'failure' }).catch(() => undefined);
    }
    const response = errorResponse(error);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
