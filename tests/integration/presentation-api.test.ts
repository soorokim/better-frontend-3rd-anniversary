import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  answers,
  avatarAssignments,
  participants,
  presentationItems,
  presentationSessions,
} from '@/db/schema';
import { closeDatabase } from '@/lib/db/client';
import { issueSession } from '@/lib/auth/session';
import { createTestDatabase } from '@/tests/helpers/database';
import {
  adminFactory,
  answerFactory,
  eventFactory,
  participantFactory,
  questionFactory,
} from '@/tests/helpers/factories';

let activeCookie: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => activeCookie ? { value: activeCookie } : undefined }),
}));

const origin = 'http://localhost:3000';

function commandRequest(body: unknown, csrf?: string, requestOrigin = origin) {
  return new Request(`${origin}/api/admin/presentation/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: requestOrigin,
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('presenter controller API contract', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let adminToken: string;
  let adminCsrf: string;
  let participantToken: string;
  let foreignAnswerId: string;
  let eventId: string;
  let questionId: string;
  let eventParticipants: Array<typeof participants.$inferSelect>;
  let eventAnswers: Array<typeof answers.$inferSelect>;

  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => {
    await database.reset();
    activeCookie = undefined;

    const event = await eventFactory(database.db, { slug: 'presenter-event' });
    eventId = event.id;
    const admin = await adminFactory(database.db, event.id);
    const question = await questionFactory(database.db, event.id);
    questionId = question.id;
    const participantNames = ['픽셀고양이', '자바스크립트요정', '리액트탐험가', 'CSS마법사'];
    eventParticipants = [];

    for (const nickname of participantNames) {
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
        selectedTraits: { hair: 'bob', body: 'warm', outfit: 'hoodie', accessory: 'none', accent: 'pink' },
      }).returning();
      await database.db.update(participants).set({ currentAvatarId: avatar.id }).where(eq(participants.id, participant.id));
      eventParticipants.push(participant);
    }

    eventAnswers = [];
    for (const [index, participant] of eventParticipants.slice(0, 3).entries()) {
      const [answer] = await database.db.insert(answers).values({
        participantId: participant.id,
        questionId: question.id,
        content: `3주년 답변 ${index + 1}`,
      }).returning();
      eventAnswers.push(answer);
    }

    const adminSession = await issueSession('admin', admin.id, admin.authVersion);
    adminToken = adminSession.token;
    adminCsrf = adminSession.csrfToken;
    const participantSession = await issueSession('participant', eventParticipants[0].id, eventParticipants[0].authVersion);
    participantToken = participantSession.token;

    const foreignEvent = await eventFactory(database.db, { slug: 'foreign-event' });
    const foreignQuestion = await questionFactory(database.db, foreignEvent.id);
    const foreignParticipant = await participantFactory(database.db, foreignEvent.id);
    const [foreignAnswer] = await database.db.insert(answers).values({
      participantId: foreignParticipant.id,
      questionId: foreignQuestion.id,
      content: '다른 행사의 비공개 답변',
    }).returning();
    foreignAnswerId = foreignAnswer.id;
  });
  afterAll(async () => {
    await closeDatabase();
    await database?.close();
  });

  it('rejects an unauthenticated or participant session without exposing controller data', async () => {
    const { GET } = await import('@/app/api/admin/presentation/route');

    expect((await GET()).status).toBe(401);
    activeCookie = participantToken;
    const participantResponse = await GET();
    expect(participantResponse.status).toBe(401);
    expect(JSON.stringify(await participantResponse.json())).not.toContain('3주년 답변');
  });

  it('returns 4/3/1 summary and only the controller allowlist to an admin', async () => {
    activeCookie = adminToken;
    const { GET } = await import('@/app/api/admin/presentation/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, private');
    expect(Object.keys(body).sort()).toEqual(['answers', 'currentSlide', 'question', 'session', 'summary']);
    expect(body.summary).toEqual({ total: 4, submitted: 3, notSubmitted: 1 });
    expect(body.currentSlide).toBeNull();
    expect(body.answers).toHaveLength(3);
    expect(Object.keys(body.answers[0]).sort()).toEqual([
      'author', 'content', 'id', 'presentationOrder', 'status', 'submittedAt', 'updatedAt',
    ]);
    expect(Object.keys(body.answers[0].author).sort()).toEqual(['avatar', 'nickname']);
    expect(Object.keys(body.answers[0].author.avatar).sort()).toEqual(['catalogVersion', 'generatorVersion', 'traits']);
    expect(body.answers.every((answer: { status: string; presentationOrder: number | null }) =>
      answer.status === 'unpresented' && answer.presentationOrder === null)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('participantId');
    expect(JSON.stringify(body)).not.toContain('sourceDigest');
  });

  it('requires both the trusted Origin and matching CSRF token for commands', async () => {
    activeCookie = adminToken;
    const { POST } = await import('@/app/api/admin/presentation/commands/route');

    expect((await POST(commandRequest({ type: 'select_random' }))).status).toBe(403);
    expect((await POST(commandRequest({ type: 'select_random' }, adminCsrf, 'https://attacker.example'))).status).toBe(403);
    expect((await POST(commandRequest({ type: 'select_random' }, 'wrong-csrf-token'))).status).toBe(403);
    expect((await POST(commandRequest({ type: 'select_random' }, adminCsrf))).status).toBe(200);
  });

  it('selects anonymously, reveals the exact author, and rejects another event answer as 404', async () => {
    activeCookie = adminToken;
    const { GET } = await import('@/app/api/admin/presentation/route');
    const { POST } = await import('@/app/api/admin/presentation/commands/route');

    const selectedResponse = await POST(commandRequest({ type: 'select_random' }, adminCsrf));
    const selected = await selectedResponse.json();
    expect(selectedResponse.status).toBe(200);
    expect(selected.currentSlide).toMatchObject({ authorRevealed: false, presentationOrder: 1 });
    expect(selected.currentSlide.author.nickname).toBeTruthy();
    expect(selected.answers.filter((answer: { status: string }) => answer.status === 'current')).toHaveLength(1);

    const revealedResponse = await POST(commandRequest({ type: 'set_author_visibility', revealed: true }, adminCsrf));
    const revealed = await revealedResponse.json();
    expect(revealedResponse.status).toBe(200);
    expect(revealed.currentSlide).toMatchObject({
      answerId: selected.currentSlide.answerId,
      content: selected.currentSlide.content,
      authorRevealed: true,
      author: selected.currentSlide.author,
    });

    const foreign = await POST(commandRequest({ type: 'select_answer', answerId: foreignAnswerId }, adminCsrf));
    expect(foreign.status).toBe(404);
    expect(await GET()).toHaveProperty('status', 200);
  });

  it('keeps the current snapshot fixed until an explicit reselect refreshes it', async () => {
    activeCookie = adminToken;
    const { GET } = await import('@/app/api/admin/presentation/route');
    const { POST } = await import('@/app/api/admin/presentation/commands/route');
    const original = eventAnswers[0];

    const firstResponse = await POST(commandRequest({
      type: 'select_answer',
      answerId: original.id,
    }, adminCsrf));
    const first = await firstResponse.json();
    expect(firstResponse.status).toBe(200);
    expect(first.currentSlide).toMatchObject({
      answerId: original.id,
      content: original.content,
      presentationOrder: 1,
      authorRevealed: false,
    });

    const latestContent = '참가자가 발표 도중 고친 최신 답변';
    await database.db.update(answers).set({
      content: latestContent,
      updatedAt: new Date('2026-08-30T12:34:56.000Z'),
    }).where(eq(answers.id, original.id));

    const beforeReselect = await (await GET()).json();
    expect(beforeReselect.currentSlide).toMatchObject({
      answerId: original.id,
      content: original.content,
      presentationOrder: 1,
    });
    expect(beforeReselect.answers.find((answer: { id: string }) => answer.id === original.id)).toMatchObject({
      content: latestContent,
      status: 'current',
      presentationOrder: 1,
    });

    const reselectedResponse = await POST(commandRequest({
      type: 'select_answer',
      answerId: original.id,
    }, adminCsrf));
    const reselected = await reselectedResponse.json();
    expect(reselectedResponse.status).toBe(200);
    expect(reselected.currentSlide).toMatchObject({
      answerId: original.id,
      content: latestContent,
      presentationOrder: 1,
      authorRevealed: false,
    });

    const savedItems = await database.db.select().from(presentationItems);
    expect(savedItems).toHaveLength(1);
    expect(savedItems[0]).toMatchObject({
      answerId: original.id,
      contentSnapshot: latestContent,
      presentationOrder: 1,
    });
  });

  it('adds a newly submitted answer without disturbing current state or prior order', async () => {
    activeCookie = adminToken;
    const { GET } = await import('@/app/api/admin/presentation/route');
    const { POST } = await import('@/app/api/admin/presentation/commands/route');

    const selected = await (await POST(commandRequest({
      type: 'select_answer',
      answerId: eventAnswers[0].id,
    }, adminCsrf))).json();
    const revisionBeforeSubmission = selected.session.revision;

    const newAnswer = await answerFactory(
      database.db,
      eventParticipants[3].id,
      questionId,
      { content: '진행 중에 새로 들어온 답변' },
    );
    const refreshed = await (await GET()).json();

    expect(refreshed.summary).toEqual({ total: 4, submitted: 4, notSubmitted: 0 });
    expect(refreshed.session.revision).toBe(revisionBeforeSubmission);
    expect(refreshed.currentSlide).toMatchObject({
      answerId: eventAnswers[0].id,
      presentationOrder: 1,
    });
    expect(refreshed.answers.find((answer: { id: string }) => answer.id === newAnswer.id)).toMatchObject({
      content: '진행 중에 새로 들어온 답변',
      status: 'unpresented',
      presentationOrder: null,
    });
  });

  it('exhausts random candidates once and keeps state unchanged at the boundary', async () => {
    activeCookie = adminToken;
    const { GET } = await import('@/app/api/admin/presentation/route');
    const { POST } = await import('@/app/api/admin/presentation/commands/route');
    const selectedIds = new Set<string>();

    for (let index = 0; index < eventAnswers.length; index += 1) {
      const response = await POST(commandRequest({ type: 'select_random' }, adminCsrf));
      const body = await response.json();
      expect(response.status).toBe(200);
      selectedIds.add(body.currentSlide.answerId);
      expect(body.currentSlide.presentationOrder).toBe(index + 1);
      expect(body.currentSlide.authorRevealed).toBe(false);
    }

    expect(selectedIds).toEqual(new Set(eventAnswers.map((answer) => answer.id)));
    const exhaustedView = await (await GET()).json();
    const exhaustedResponse = await POST(commandRequest({ type: 'select_random' }, adminCsrf));
    const exhaustedError = await exhaustedResponse.json();
    expect(exhaustedResponse.status).toBe(409);
    expect(exhaustedError.error?.code).toBe('all_answers_presented');
    expect(await (await GET()).json()).toMatchObject({
      session: exhaustedView.session,
      currentSlide: exhaustedView.currentSlide,
    });
  });

  it('navigates in first-presentation order, resets author visibility, and rejects boundaries', async () => {
    activeCookie = adminToken;
    const { GET } = await import('@/app/api/admin/presentation/route');
    const { POST } = await import('@/app/api/admin/presentation/commands/route');

    for (const answer of eventAnswers.slice(0, 2)) {
      expect((await POST(commandRequest({ type: 'select_answer', answerId: answer.id }, adminCsrf))).status).toBe(200);
    }
    expect((await POST(commandRequest({ type: 'set_author_visibility', revealed: true }, adminCsrf))).status).toBe(200);

    const previousResponse = await POST(commandRequest({
      type: 'navigate', direction: 'previous',
    }, adminCsrf));
    const previous = await previousResponse.json();
    expect(previousResponse.status).toBe(200);
    expect(previous.currentSlide).toMatchObject({
      answerId: eventAnswers[0].id,
      presentationOrder: 1,
      authorRevealed: false,
    });

    const atBoundary = await (await GET()).json();
    const boundaryResponse = await POST(commandRequest({
      type: 'navigate', direction: 'previous',
    }, adminCsrf));
    expect(boundaryResponse.status).toBe(409);
    expect((await boundaryResponse.json()).error?.code).toBe('navigation_boundary');
    expect(await (await GET()).json()).toMatchObject({
      session: atBoundary.session,
      currentSlide: atBoundary.currentSlide,
    });

    const next = await (await POST(commandRequest({
      type: 'navigate', direction: 'next',
    }, adminCsrf))).json();
    expect(next.currentSlide).toMatchObject({
      answerId: eventAnswers[1].id,
      presentationOrder: 2,
      authorRevealed: false,
    });
  });

  it('restarts only with explicit confirmation and preserves every original answer', async () => {
    activeCookie = adminToken;
    const { GET } = await import('@/app/api/admin/presentation/route');
    const { POST } = await import('@/app/api/admin/presentation/commands/route');

    for (const answer of eventAnswers.slice(0, 2)) {
      expect((await POST(commandRequest({ type: 'select_answer', answerId: answer.id }, adminCsrf))).status).toBe(200);
    }
    expect((await POST(commandRequest({ type: 'set_author_visibility', revealed: true }, adminCsrf))).status).toBe(200);

    const before = await (await GET()).json();
    const originalsBefore = await database.db.select().from(answers);
    const unconfirmed = await POST(commandRequest({ type: 'restart', confirmed: false }, adminCsrf));
    expect(unconfirmed.status).toBe(400);
    expect(await database.db.select().from(presentationItems)).toHaveLength(2);

    const restartedResponse = await POST(commandRequest({ type: 'restart', confirmed: true }, adminCsrf));
    const restarted = await restartedResponse.json();
    expect(restartedResponse.status).toBe(200);
    expect(restarted.session).toMatchObject({
      revision: before.session.revision + 1,
      currentItemId: null,
      authorRevealed: false,
      allPresented: false,
    });
    expect(restarted.currentSlide).toBeNull();
    expect(restarted.answers.every((answer: { status: string; presentationOrder: number | null }) =>
      answer.status === 'unpresented' && answer.presentationOrder === null)).toBe(true);
    expect(await database.db.select().from(presentationItems)).toHaveLength(0);
    expect(await database.db.select().from(answers)).toEqual(originalsBefore);

    const recovered = await (await GET()).json();
    expect(recovered).toMatchObject({
      session: restarted.session,
      currentSlide: null,
      answers: restarted.answers,
    });
    const [savedSession] = await database.db.select().from(presentationSessions)
      .where(eq(presentationSessions.eventId, eventId));
    expect(savedSession).toMatchObject({
      revision: restarted.session.revision,
      currentItemId: null,
      authorRevealed: false,
    });
  });

  it('protects the projector endpoint and returns only a private waiting slide to an admin', async () => {
    const { GET } = await import('@/app/api/admin/presentation/screen/route');

    const unauthenticated = await GET();
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get('cache-control')).toBe('no-store, private');
    expect(JSON.stringify(await unauthenticated.json())).not.toContain('3주년 답변');

    activeCookie = participantToken;
    const participantResponse = await GET();
    expect(participantResponse.status).toBe(401);
    expect(participantResponse.headers.get('cache-control')).toBe('no-store, private');
    expect(JSON.stringify(await participantResponse.json())).not.toContain('3주년 답변');

    activeCookie = adminToken;
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, private');
    expect(body).toEqual({
      question: { id: questionId, prompt: '기억에 남는 순간은?' },
      revision: 0,
      updatedAt: null,
      slide: { kind: 'waiting' },
    });
    expect(Object.keys(body).sort()).toEqual(['question', 'revision', 'slide', 'updatedAt']);
    expect(JSON.stringify(body)).not.toMatch(/answers|summary|participantId|answerId|itemId|currentItemId/);
  });

  it('never sends answer IDs, candidates, or a hidden author to the projector', async () => {
    activeCookie = adminToken;
    const { GET } = await import('@/app/api/admin/presentation/screen/route');
    const { POST } = await import('@/app/api/admin/presentation/commands/route');

    const selectedController = await (await POST(commandRequest({
      type: 'select_answer',
      answerId: eventAnswers[1].id,
    }, adminCsrf))).json();
    const anonymousResponse = await GET();
    const anonymous = await anonymousResponse.json();

    expect(anonymousResponse.status).toBe(200);
    expect(anonymousResponse.headers.get('cache-control')).toBe('no-store, private');
    expect(anonymous).toEqual({
      question: { id: questionId, prompt: '기억에 남는 순간은?' },
      revision: selectedController.session.revision,
      updatedAt: selectedController.session.updatedAt,
      slide: {
        kind: 'answer',
        content: eventAnswers[1].content,
      },
    });
    expect(Object.hasOwn(anonymous.slide, 'author')).toBe(false);
    const anonymousJson = JSON.stringify(anonymous);
    expect(anonymousJson).not.toContain(eventAnswers[1].id);
    expect(anonymousJson).not.toContain(eventParticipants[1].id);
    expect(anonymousJson).not.toContain(eventParticipants[1].nicknameDisplay);
    expect(anonymousJson).not.toMatch(/answers|summary|answerId|itemId|currentItemId|presentationOrder|sourceDigest/);

    const revealedController = await (await POST(commandRequest({
      type: 'set_author_visibility',
      revealed: true,
    }, adminCsrf))).json();
    const revealedResponse = await GET();
    const revealed = await revealedResponse.json();

    expect(revealedResponse.status).toBe(200);
    expect(revealed).toEqual({
      question: { id: questionId, prompt: '기억에 남는 순간은?' },
      revision: revealedController.session.revision,
      updatedAt: revealedController.session.updatedAt,
      slide: {
        kind: 'answer',
        content: eventAnswers[1].content,
        author: {
          nickname: eventParticipants[1].nicknameDisplay,
          avatar: selectedController.currentSlide.author.avatar,
        },
      },
    });
    expect(JSON.stringify(revealed)).not.toMatch(/answers|summary|answerId|itemId|currentItemId|presentationOrder|sourceDigest/);
  });

  it('keeps exact conversation avatar traits in controller and projector snapshots', async () => {
    activeCookie = adminToken;
    const conversationTraits = {
      hair: 'short01',
      eyes: 'variant04',
      mouth: 'happy03',
      clothing: 'variant12',
      className: 'steady-debugger',
      item: 'terminal-keyboard',
      status: 'reviewing-the-memory',
    };
    const participant = eventParticipants[0];
    const [conversationAvatar] = await database.db.insert(avatarAssignments).values({
      participantId: participant.id,
      sourceKind: 'conversation',
      sourceVersion: 'conversation-summary-v1',
      sourceDigest: 'a'.repeat(64),
      generatorVersion: 'developer-profile-v1',
      catalogVersion: 'developer-profile-catalog-v1',
      selectedTraits: conversationTraits,
    }).returning();
    await database.db.update(participants)
      .set({ currentAvatarId: conversationAvatar.id })
      .where(eq(participants.id, participant.id));

    const { POST } = await import('@/app/api/admin/presentation/commands/route');
    const { GET: getProjector } = await import('@/app/api/admin/presentation/screen/route');
    const selected = await (await POST(commandRequest({
      type: 'select_answer',
      answerId: eventAnswers[0].id,
    }, adminCsrf))).json();
    expect(selected.currentSlide.author.avatar).toEqual({
      generatorVersion: 'developer-profile-v1',
      catalogVersion: 'developer-profile-catalog-v1',
      traits: conversationTraits,
    });

    await POST(commandRequest({ type: 'set_author_visibility', revealed: true }, adminCsrf));
    const projector = await (await getProjector()).json();
    expect(projector.slide.author.avatar).toEqual(selected.currentSlide.author.avatar);
    const [savedItem] = await database.db.select().from(presentationItems)
      .where(eq(presentationItems.answerId, eventAnswers[0].id));
    expect(savedItem.avatarSnapshot).toEqual(selected.currentSlide.author.avatar);
  });
});
