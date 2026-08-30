import { databaseHealthCheck } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await databaseHealthCheck();
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
