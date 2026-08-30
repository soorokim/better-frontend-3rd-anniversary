import { describe, expect, it } from 'vitest';
import { presentationCommandSchema } from '@/lib/validation/presentation';
import { buildPresentationControllerView } from '@/lib/presentation/presentation-view';

const ids = {
  question: '00000000-0000-4000-8000-000000000001',
  answerOne: '00000000-0000-4000-8000-000000000002',
  answerTwo: '00000000-0000-4000-8000-000000000003',
  itemTwo: '00000000-0000-4000-8000-000000000004',
  itemOne: '00000000-0000-4000-8000-000000000005',
};

describe('presentation command validation', () => {
  it.each([
    [{ type: 'select_answer' }, 'answerId'],
    [{ type: 'select_answer', answerId: 'not-a-uuid' }, 'answerId'],
    [{ type: 'select_random', answerId: ids.answerOne }, ''],
    [{ type: 'set_author_visibility', revealed: 'true' }, 'revealed'],
    [{ type: 'restart', confirmed: false }, 'confirmed'],
    [{ type: 'delete_answer', answerId: ids.answerOne }, 'type'],
  ])('rejects a command outside the allowlist: %o', (command, field) => {
    const result = presentationCommandSchema.safeParse(command);

    expect(result.success).toBe(false);
    if (!result.success && field) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === field)).toBe(true);
    }
  });

  it.each([
    { type: 'select_answer', answerId: ids.answerOne },
    { type: 'select_random' },
    { type: 'set_author_visibility', revealed: true },
    { type: 'navigate', direction: 'previous' },
    { type: 'navigate', direction: 'next' },
    { type: 'restart', confirmed: true },
  ])('accepts a supported presenter command: %o', (command) => {
    expect(presentationCommandSchema.safeParse(command).success).toBe(true);
  });

  it.each([
    { type: 'navigate', direction: 'first' },
    { type: 'navigate', direction: true },
    { type: 'restart' },
    { type: 'restart', confirmed: false },
    { type: 'restart', confirmed: true, keepCurrent: true },
  ])('rejects an invalid navigation or unconfirmed restart command: %o', (command) => {
    expect(presentationCommandSchema.safeParse(command).success).toBe(false);
  });
});

describe('presentation controller state', () => {
  it('derives summary and current/presented/unpresented answer states', () => {
    const now = new Date('2026-08-30T10:00:00.000Z');
    const avatar = {
      generatorVersion: 'avatar-v1',
      catalogVersion: 'pixel-parts-v1',
      traits: { hair: 'bob', outfit: 'hoodie' },
    };

    const view = buildPresentationControllerView({
      question: { id: ids.question, prompt: '3주년을 맞은 기분은?' },
      participantCount: 3,
      session: {
        revision: 2,
        currentItemId: ids.itemTwo,
        authorRevealed: false,
        updatedAt: now,
      },
      currentSlide: {
        itemId: ids.itemTwo,
        answerId: ids.answerTwo,
        content: '함께라서 좋았어요.',
        nickname: '픽셀고양이',
        avatar,
        presentationOrder: 1,
      },
      answers: [
        {
          id: ids.answerOne,
          content: '첫 번째 답변',
          submittedAt: now,
          updatedAt: now,
          nickname: 'CSS마법사',
          avatar,
          presentationItemId: null,
          presentationOrder: null,
        },
        {
          id: ids.answerTwo,
          content: '함께라서 좋았어요.',
          submittedAt: now,
          updatedAt: now,
          nickname: '픽셀고양이',
          avatar,
          presentationItemId: ids.itemTwo,
          presentationOrder: 1,
        },
      ],
    });

    expect(view.summary).toEqual({ total: 3, submitted: 2, notSubmitted: 1 });
    expect(view.session).toMatchObject({
      revision: 2,
      currentItemId: ids.itemTwo,
      authorRevealed: false,
      allPresented: false,
    });
    expect(view.answers.map((answer: { id: string; status: string }) => ({ id: answer.id, status: answer.status }))).toEqual([
      { id: ids.answerOne, status: 'unpresented' },
      { id: ids.answerTwo, status: 'current' },
    ]);
    expect(view.currentSlide).toMatchObject({
      itemId: ids.itemTwo,
      answerId: ids.answerTwo,
      authorRevealed: false,
      author: { nickname: '픽셀고양이', avatar },
    });
  });

  it('reports random exhaustion without changing the current revealed slide', () => {
    const now = new Date('2026-08-30T10:00:00.000Z');
    const avatar = {
      generatorVersion: 'avatar-v1',
      catalogVersion: 'pixel-parts-v1',
      traits: { hair: 'bob', outfit: 'hoodie' },
    };

    const view = buildPresentationControllerView({
      question: { id: ids.question, prompt: '3주년을 맞은 기분은?' },
      participantCount: 2,
      session: {
        revision: 7,
        currentItemId: ids.itemTwo,
        authorRevealed: true,
        updatedAt: now,
      },
      currentSlide: {
        itemId: ids.itemTwo,
        answerId: ids.answerTwo,
        content: '두 번째 답변',
        nickname: '픽셀고양이',
        avatar,
        presentationOrder: 2,
      },
      answers: [
        {
          id: ids.answerOne,
          content: '첫 번째 답변',
          submittedAt: now,
          updatedAt: now,
          nickname: 'CSS마법사',
          avatar,
          presentationItemId: ids.itemOne,
          presentationOrder: 1,
        },
        {
          id: ids.answerTwo,
          content: '두 번째 답변',
          submittedAt: now,
          updatedAt: now,
          nickname: '픽셀고양이',
          avatar,
          presentationItemId: ids.itemTwo,
          presentationOrder: 2,
        },
      ],
    });

    expect(view.session).toMatchObject({
      revision: 7,
      allPresented: true,
      currentItemId: ids.itemTwo,
      authorRevealed: true,
    });
    expect(view.answers.map((answer) => answer.status)).toEqual(['presented', 'current']);
    expect(view.currentSlide).toMatchObject({
      answerId: ids.answerTwo,
      presentationOrder: 2,
      authorRevealed: true,
    });
  });

  it('represents navigation as one current item and resets author visibility', () => {
    const now = new Date('2026-08-30T10:00:00.000Z');
    const avatar = {
      generatorVersion: 'avatar-v1',
      catalogVersion: 'pixel-parts-v1',
      traits: { hair: 'bob', outfit: 'hoodie' },
    };
    const answers = [
      {
        id: ids.answerOne,
        content: '첫 번째 답변',
        submittedAt: now,
        updatedAt: now,
        nickname: 'CSS마법사',
        avatar,
        presentationItemId: ids.itemOne,
        presentationOrder: 1,
      },
      {
        id: ids.answerTwo,
        content: '두 번째 답변',
        submittedAt: now,
        updatedAt: now,
        nickname: '픽셀고양이',
        avatar,
        presentationItemId: ids.itemTwo,
        presentationOrder: 2,
      },
    ];

    const view = buildPresentationControllerView({
      question: { id: ids.question, prompt: '3주년을 맞은 기분은?' },
      participantCount: 2,
      session: {
        revision: 8,
        currentItemId: ids.itemOne,
        authorRevealed: false,
        updatedAt: now,
      },
      currentSlide: {
        itemId: ids.itemOne,
        answerId: ids.answerOne,
        content: '첫 번째 답변',
        nickname: 'CSS마법사',
        avatar,
        presentationOrder: 1,
      },
      answers,
    });

    expect(view.currentSlide).toMatchObject({
      itemId: ids.itemOne,
      answerId: ids.answerOne,
      authorRevealed: false,
    });
    expect(view.answers.map((answer) => answer.status)).toEqual(['current', 'presented']);
  });

  it('returns to a waiting state after restart while keeping submitted answers unpresented', () => {
    const now = new Date('2026-08-30T10:00:00.000Z');
    const avatar = {
      generatorVersion: 'avatar-v1',
      catalogVersion: 'pixel-parts-v1',
      traits: { hair: 'bob', outfit: 'hoodie' },
    };

    const view = buildPresentationControllerView({
      question: { id: ids.question, prompt: '3주년을 맞은 기분은?' },
      participantCount: 1,
      session: {
        revision: 9,
        currentItemId: null,
        authorRevealed: false,
        updatedAt: now,
      },
      currentSlide: null,
      answers: [{
        id: ids.answerOne,
        content: '원본 답변은 남아 있어요.',
        submittedAt: now,
        updatedAt: now,
        nickname: 'CSS마법사',
        avatar,
        presentationItemId: null,
        presentationOrder: null,
      }],
    });

    expect(view.session).toMatchObject({
      revision: 9,
      currentItemId: null,
      authorRevealed: false,
      allPresented: false,
    });
    expect(view.currentSlide).toBeNull();
    expect(view.answers[0]).toMatchObject({ status: 'unpresented', presentationOrder: null });
  });
});
