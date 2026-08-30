import { and, asc, eq, sql } from 'drizzle-orm';
import { adminAccounts, answers, avatarAssignments, participants } from '@/db/schema';
import { db } from '@/lib/db/client';

export async function findAdminByUsername(eventId: string, username: string) {
  const [admin] = await db.select().from(adminAccounts).where(and(eq(adminAccounts.eventId, eventId), eq(adminAccounts.username, username))).limit(1);
  return admin;
}

export async function listAdminParticipants(eventId: string) {
  const rows = await db.select({
    id: participants.id,
    nickname: participants.nicknameDisplay,
    joinedAt: participants.createdAt,
    avatar: { generatorVersion: avatarAssignments.generatorVersion, catalogVersion: avatarAssignments.catalogVersion, traits: avatarAssignments.selectedTraits },
    answerCount: sql<number>`count(distinct ${answers.id})::int`,
  }).from(participants)
    .leftJoin(avatarAssignments, eq(avatarAssignments.id, participants.currentAvatarId))
    .leftJoin(answers, eq(answers.participantId, participants.id))
    .where(eq(participants.eventId, eventId))
    .groupBy(participants.id, avatarAssignments.id)
    .orderBy(asc(participants.nicknameKey));
  return rows.map(({ answerCount, ...row }) => ({ ...row, answerStatus: answerCount > 0 ? 'submitted' as const : 'not-submitted' as const }));
}
