import { getEnv } from '@/lib/config/env';
import { findAdminByUsername, listAdminParticipants } from '@/lib/db/repositories/admin';
import { findEventBySlug } from '@/lib/db/repositories/participants';
import { createAuditEvent } from '@/lib/db/repositories/audit';
import { AppError } from '@/lib/http/errors';
import { clearThrottle, readThrottle, recordFailure, throttleSubject } from '@/lib/security/rate-limit';
import { verifySecret } from '@/lib/security/crypto';
import { issueSession } from './session';
import { adminSessions } from '@/db/schema';
import { db } from '@/lib/db/client';
import { eq } from 'drizzle-orm';
import { adminConversationProfileSummary } from '@/lib/db/repositories/conversation-profiles';

const RECENT_AUTH_MS = 5 * 60_000;

export async function loginAdmin(input: { username: string; password: string; ipAddress: string }) {
  const event = await findEventBySlug(getEnv().EVENT_SLUG);
  if (!event) throw new AppError('invalid_credentials', '관리자 정보를 확인해 주세요.', 401);
  const subject = throttleSubject(event.id, input.username, input.ipAddress); const throttle = await readThrottle('admin_login', subject);
  if (throttle.blocked) throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, throttle.retryAfter);
  const admin = await findAdminByUsername(event.id, input.username);
  if (!admin || !(await verifySecret(admin.passwordHash, input.password))) {
    const failure = await recordFailure('admin_login', subject); await createAuditEvent({ eventId: event.id, action: 'admin_login', outcome: 'failure' });
    throw new AppError('invalid_credentials', failure.blocked ? '잠시 기다린 뒤 다시 시도해 주세요.' : '관리자 정보를 확인해 주세요.', failure.blocked ? 429 : 401, undefined, failure.retryAfter || undefined);
  }
  await clearThrottle('admin_login', subject); await createAuditEvent({ eventId: event.id, adminId: admin.id, action: 'admin_login', outcome: 'success' });
  return { admin, session: await issueSession('admin', admin.id, admin.authVersion) };
}

export async function requireRecentAdminAuthentication(admin: { passwordHash: string }, session: { id: string; authenticatedAt: Date }, password?: string) {
  if (Date.now() - session.authenticatedAt.getTime() <= RECENT_AUTH_MS) return;
  if (!password || !(await verifySecret(admin.passwordHash, password))) throw new AppError('reauthentication_required', '관리자 비밀번호를 다시 확인해 주세요.', 403, 'password');
  const now = new Date(); await db.update(adminSessions).set({ authenticatedAt: now }).where(eq(adminSessions.id, session.id)); session.authenticatedAt = now;
}

export function adminParticipantList(eventId: string) { return listAdminParticipants(eventId); }
export function adminAvatarProfileSummary(eventId: string) { return adminConversationProfileSummary(eventId); }
