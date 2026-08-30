import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { adminAccounts, participants } from '@/db/schema';
import { db } from '@/lib/db/client';
import { authCookiePolicy } from './cookies';
import { findSession } from './session';
import { UnauthorizedError } from '@/lib/http/errors';

export async function requireParticipant() {
  const token = (await cookies()).get(authCookiePolicy().names.participant)?.value;
  if (!token) throw new UnauthorizedError();
  const session = await findSession('participant', token);
  if (!session) throw new UnauthorizedError();
  const [participant] = await db.select().from(participants).where(eq(participants.id, session.participantId)).limit(1);
  if (!participant || participant.authVersion !== session.authVersion) throw new UnauthorizedError();
  return { participant, session, token };
}

export async function requireAdmin() {
  const token = (await cookies()).get(authCookiePolicy().names.admin)?.value;
  if (!token) throw new UnauthorizedError();
  const session = await findSession('admin', token);
  if (!session) throw new UnauthorizedError();
  const [admin] = await db.select().from(adminAccounts).where(eq(adminAccounts.id, session.adminId)).limit(1);
  if (!admin || admin.authVersion !== session.authVersion) throw new UnauthorizedError();
  return { admin, session, token };
}
