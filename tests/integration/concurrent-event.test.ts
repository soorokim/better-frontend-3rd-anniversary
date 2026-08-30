import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  answers,
  authThrottles,
  avatarAssignments,
  participantSessions,
  participants,
} from '@/db/schema';
import { saveCurrentAnswer } from '@/lib/answers/answer-service';
import { loginParticipant, registerParticipant } from '@/lib/auth/participant-service';
import { closeDatabase } from '@/lib/db/client';
import { createTestDatabase } from '@/tests/helpers/database';
import { eventFactory, questionFactory } from '@/tests/helpers/factories';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';

const PARTICIPANT_COUNT = 30;
const SHARED_IP = '192.0.2.30';
const FIVE_MINUTES_MS = 5 * 60_000;

type LoadParticipant = {
  nickname: string;
  pin: string;
  answer: string;
};

const loadParticipants: LoadParticipant[] = Array.from(
  { length: PARTICIPANT_COUNT },
  (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      nickname: `동시참가자${number}`,
      pin: String(100_000 + index),
      answer: `동시 행사 답변 ${number}`,
    };
  },
);

describe('30-participant concurrent event use', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.reset();
  });

  afterAll(async () => {
    await closeDatabase();
    await database?.close();
  });

  it('keeps registrations, avatars, logins, and owned answers intact on one venue IP', async () => {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' });
    await conversationProfileBatchFactory(database.db, event.id, loadParticipants.map(({ nickname }, index) => ({
      nickname,
      digest: (index + 1).toString(16).padStart(64, '0'),
    })));
    const question = await questionFactory(database.db, event.id);
    const startedAt = performance.now();

    // Each participant starts independently. As soon as one registration
    // finishes, its login and answer save overlap with the remaining work.
    const results = await Promise.all(loadParticipants.map(async (fixture) => {
      const authInput = {
        inviteCode: 'test-invite-code-1234',
        nickname: fixture.nickname,
        pin: fixture.pin,
        ipAddress: SHARED_IP,
      };
      const registration = await registerParticipant(authInput);
      const [login, savedAnswer] = await Promise.all([
        loginParticipant(authInput),
        saveCurrentAnswer(registration.view.id, event.id, fixture.answer),
      ]);

      return { fixture, registration, login, savedAnswer };
    }));

    expect(performance.now() - startedAt).toBeLessThan(FIVE_MINUTES_MS);
    expect(results).toHaveLength(PARTICIPANT_COUNT);
    expect(new Set(results.map(({ registration }) => registration.view.id)).size)
      .toBe(PARTICIPANT_COUNT);
    expect(new Set(results.map(({ registration }) => registration.view.nickname)).size)
      .toBe(PARTICIPANT_COUNT);

    for (const { fixture, registration, login, savedAnswer } of results) {
      expect(login.view).toEqual(registration.view);
      expect(savedAnswer).toMatchObject({
        questionId: question.id,
        content: fixture.answer,
      });
    }

    const [participantRows, avatarRows, answerRows, sessionRows] = await Promise.all([
      database.db.select().from(participants).where(eq(participants.eventId, event.id)),
      database.db.select().from(avatarAssignments),
      database.db.select().from(answers).where(eq(answers.questionId, question.id)),
      database.db.select().from(participantSessions),
    ]);

    expect(participantRows).toHaveLength(PARTICIPANT_COUNT);
    expect(new Set(participantRows.map((participant) => participant.nicknameKey)).size)
      .toBe(PARTICIPANT_COUNT);
    expect(avatarRows).toHaveLength(PARTICIPANT_COUNT);
    expect(answerRows).toHaveLength(PARTICIPANT_COUNT);
    // Registration and login must each issue a distinct session.
    expect(sessionRows).toHaveLength(PARTICIPANT_COUNT * 2);

    const fixtureByNickname = new Map(loadParticipants.map((fixture) => [fixture.nickname, fixture]));
    const participantById = new Map(participantRows.map((participant) => [participant.id, participant]));
    const avatarById = new Map(avatarRows.map((avatar) => [avatar.id, avatar]));

    for (const participant of participantRows) {
      const fixture = fixtureByNickname.get(participant.nicknameDisplay);
      expect(fixture).toBeDefined();
      expect(participant.currentAvatarId).not.toBeNull();
      expect(avatarById.get(participant.currentAvatarId!)?.participantId).toBe(participant.id);
    }

    for (const answer of answerRows) {
      const owner = participantById.get(answer.participantId);
      expect(owner).toBeDefined();
      expect(answer.content).toBe(fixtureByNickname.get(owner!.nicknameDisplay)?.answer);
    }

    expect(new Set(answerRows.map((answer) => answer.participantId)).size)
      .toBe(PARTICIPANT_COUNT);
    expect(new Set(avatarRows.map((avatar) => avatar.participantId)).size)
      .toBe(PARTICIPANT_COUNT);

    // Successful users sharing one venue IP must not leave an invite-level
    // throttle behind or prevent a later normal login from the same network.
    const inviteThrottles = await database.db.select().from(authThrottles)
      .where(eq(authThrottles.action, 'invite'));
    expect(inviteThrottles).toHaveLength(0);

    const probe = loadParticipants[0];
    const repeatedLogin = await loginParticipant({
      inviteCode: 'test-invite-code-1234',
      nickname: probe.nickname,
      pin: probe.pin,
      ipAddress: SHARED_IP,
    });
    expect(repeatedLogin.view.id).toBe(results[0].registration.view.id);
  }, 180_000);
});
