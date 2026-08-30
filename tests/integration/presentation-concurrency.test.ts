import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import {
  avatarAssignments,
  participants,
  presentationItems,
  presentationSessions,
} from '@/db/schema';
import { closeDatabase } from '@/lib/db/client';
import { preparePresentationSession } from '@/lib/db/repositories/presentation';
import { commandPresentation } from '@/lib/presentation/presentation-service';
import { createTestDatabase } from '@/tests/helpers/database';
import {
  answerFactory,
  eventFactory,
  participantFactory,
  questionFactory,
} from '@/tests/helpers/factories';

describe('presentation command concurrency', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let eventId: string;

  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => {
    await database.reset();
    const event = await eventFactory(database.db, { slug: 'presenter-concurrency' });
    eventId = event.id;
    const question = await questionFactory(database.db, event.id);

    for (const nickname of ['동시진행자A', '동시진행자B', '동시진행자C']) {
      const participant = await participantFactory(database.db, event.id, {
        nicknameDisplay: nickname,
        nicknameKey: nickname.toLowerCase(),
      });
      const [avatar] = await database.db.insert(avatarAssignments).values({
        participantId: participant.id,
        sourceKind: 'nickname',
        sourceVersion: 'nickname-key-v1',
        sourceDigest: `digest-${nickname}`,
        generatorVersion: 'avatar-v1',
        catalogVersion: 'pixel-parts-v1',
        selectedTraits: {
          hair: 'bob',
          body: 'warm',
          outfit: 'hoodie',
          accessory: 'none',
          accent: 'pink',
        },
      }).returning();
      await database.db.update(participants)
        .set({ currentAvatarId: avatar.id })
        .where(eq(participants.id, participant.id));
      await answerFactory(database.db, participant.id, question.id, {
        content: `${nickname}의 동시 공개 답변`,
      });
    }

    await preparePresentationSession(event.id);
  });
  afterAll(async () => {
    await closeDatabase();
    await database?.close();
  });

  it('serializes two random selections without duplicate answers or presentation orders', async () => {
    const results = await Promise.all([
      commandPresentation(eventId, { type: 'select_random' }),
      commandPresentation(eventId, { type: 'select_random' }),
    ]);

    const rows = await database.db.select().from(presentationItems)
      .orderBy(asc(presentationItems.presentationOrder));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.answerId)).size).toBe(2);
    expect(rows.map((row) => row.presentationOrder)).toEqual([1, 2]);

    const revisions = results.map((result) => result.session.revision).sort((a, b) => a - b);
    expect(revisions).toEqual([1, 2]);
    const [session] = await database.db.select().from(presentationSessions)
      .where(eq(presentationSessions.eventId, eventId));
    expect(session.revision).toBe(2);
    expect(session.currentItemId).toBe(rows[1].id);
    expect(results.find((result) => result.session.revision === 2)?.currentSlide?.answerId)
      .toBe(rows[1].answerId);
  });
});
