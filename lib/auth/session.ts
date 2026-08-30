import { and, eq, gt, isNull } from 'drizzle-orm';
import { adminSessions, participantSessions } from '@/db/schema';
import { db } from '@/lib/db/client';
import { digest, randomToken } from '@/lib/security/crypto';

const MINUTE = 60_000;
type Kind = 'participant' | 'admin';
const policy = { participant: { idle: 30 * MINUTE, absolute: 12 * 60 * MINUTE }, admin: { idle: 15 * MINUTE, absolute: 4 * 60 * MINUTE } } as const;

export async function issueSession(kind: Kind, ownerId: string, authVersion: number) {
  const token = randomToken(); const csrfToken = randomToken(); const now = new Date(); const expiresAt = new Date(now.getTime() + policy[kind].absolute);
  if (kind === 'participant') await db.insert(participantSessions).values({ participantId: ownerId, tokenHash: digest(token), csrfHash: digest(csrfToken), authVersion, expiresAt });
  else await db.insert(adminSessions).values({ adminId: ownerId, tokenHash: digest(token), csrfHash: digest(csrfToken), authVersion, expiresAt });
  return { token, csrfToken, expiresAt };
}

export async function findSession(kind: 'participant', token: string): Promise<typeof participantSessions.$inferSelect | undefined>;
export async function findSession(kind: 'admin', token: string): Promise<typeof adminSessions.$inferSelect | undefined>;
export async function findSession(kind: Kind, token: string): Promise<typeof participantSessions.$inferSelect | typeof adminSessions.$inferSelect | undefined> {
  const now = new Date(); const idleSince = new Date(now.getTime() - policy[kind].idle); const tokenHash = digest(token);
  if (kind === 'participant') {
    const [row] = await db.select().from(participantSessions).where(and(eq(participantSessions.tokenHash, tokenHash), isNull(participantSessions.revokedAt), gt(participantSessions.expiresAt, now), gt(participantSessions.lastSeenAt, idleSince))).limit(1);
    if (row) await db.update(participantSessions).set({ lastSeenAt: now }).where(eq(participantSessions.id, row.id)); return row;
  }
  const [row] = await db.select().from(adminSessions).where(and(eq(adminSessions.tokenHash, tokenHash), isNull(adminSessions.revokedAt), gt(adminSessions.expiresAt, now), gt(adminSessions.lastSeenAt, idleSince))).limit(1);
  if (row) await db.update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.id, row.id)); return row;
}

export async function revokeSession(kind: Kind, token: string): Promise<void> {
  const table = kind === 'participant' ? participantSessions : adminSessions;
  await db.update(table).set({ revokedAt: new Date() }).where(eq(table.tokenHash, digest(token)));
}

export async function revokeParticipantSessions(participantId: string): Promise<void> {
  await db.update(participantSessions).set({ revokedAt: new Date() }).where(and(eq(participantSessions.participantId, participantId), isNull(participantSessions.revokedAt)));
}
