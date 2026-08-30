import { requireAdmin } from '@/lib/auth/authorization';
import { errorResponse } from '@/lib/http/errors';
import { getPresentationScreen } from '@/lib/presentation/presentation-service';

const privateHeaders = { 'Cache-Control': 'no-store, private' };

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    return Response.json(
      await getPresentationScreen(admin.eventId),
      { headers: privateHeaders },
    );
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('Cache-Control', privateHeaders['Cache-Control']);
    return response;
  }
}
