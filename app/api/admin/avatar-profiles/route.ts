import { requireAdmin } from '@/lib/auth/authorization';
import { adminAvatarProfileSummary } from '@/lib/auth/admin-service';
import { errorResponse } from '@/lib/http/errors';

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    return Response.json(await adminAvatarProfileSummary(admin.eventId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
