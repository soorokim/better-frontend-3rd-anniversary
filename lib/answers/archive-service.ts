import { asc, eq } from 'drizzle-orm';
import { answers, avatarAssignments, participants, questionSequenceSessions, questions } from '@/db/schema';
import { db } from '@/lib/db/client';
import { AppError } from '@/lib/http/errors';

export async function participantArchive(eventId: string) {
  const [sequence] = await db.select().from(questionSequenceSessions).where(eq(questionSequenceSessions.eventId, eventId)).limit(1);
  if (!sequence || sequence.status !== 'completed') throw new AppError('archive_unavailable', '질답이 모두 끝난 뒤에 열람할 수 있습니다.', 409);
  const rows = await db.select({
    questionId: questions.id, prompt: questions.prompt, order: questions.displayOrder,
    content: answers.content, nickname: participants.nicknameDisplay,
    avatar: { generatorVersion: avatarAssignments.generatorVersion, catalogVersion: avatarAssignments.catalogVersion, traits: avatarAssignments.selectedTraits },
  }).from(questions).leftJoin(answers, eq(answers.questionId, questions.id))
    .leftJoin(participants, eq(participants.id, answers.participantId))
    .leftJoin(avatarAssignments, eq(avatarAssignments.id, participants.currentAvatarId))
    .where(eq(questions.eventId, eventId)).orderBy(asc(questions.displayOrder), asc(answers.submittedAt));
  const grouped = new Map<string, { id: string; prompt: string; answers: Array<{ content: string; author: { nickname: string; avatar: NonNullable<typeof rows[number]['avatar']> } }> }>();
  for (const row of rows) {
    const group = grouped.get(row.questionId) ?? { id: row.questionId, prompt: row.prompt, answers: [] };
    if (row.content && row.nickname && row.avatar) group.answers.push({ content: row.content, author: { nickname: row.nickname, avatar: row.avatar } });
    grouped.set(row.questionId, group);
  }
  return { status: 'completed' as const, questions: [...grouped.values()] };
}
