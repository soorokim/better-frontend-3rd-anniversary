import { describe, expect, it, vi } from 'vitest';
import {
  buildPresentationScreenView,
  type PresentationControllerView,
} from '@/lib/presentation/presentation-view';
import { logger } from '@/lib/observability/logger';

const avatar = {
  generatorVersion: 'avatar-v1',
  catalogVersion: 'pixel-parts-v1',
  traits: { hair: 'bob', outfit: 'hoodie', accent: 'pink' },
};

function controllerView(
  overrides: Partial<PresentationControllerView> = {},
): PresentationControllerView {
  return {
    question: {
      id: '11111111-1111-4111-8111-111111111111',
      prompt: '기억에 남는 순간은?',
    },
    summary: { total: 4, submitted: 3, notSubmitted: 1 },
    session: {
      revision: 0,
      currentItemId: null,
      authorRevealed: false,
      allPresented: false,
      updatedAt: null,
    },
    currentSlide: null,
    answers: [],
    ...overrides,
  };
}

function currentControllerView(authorRevealed: boolean) {
  return controllerView({
    session: {
      revision: 7,
      currentItemId: '22222222-2222-4222-8222-222222222222',
      authorRevealed,
      allPresented: false,
      updatedAt: '2026-08-30T09:10:11.000Z',
    },
    currentSlide: {
      itemId: '22222222-2222-4222-8222-222222222222',
      answerId: '33333333-3333-4333-8333-333333333333',
      content: '서로의 코드를 보며\n웃었던 순간 ✨',
      author: { nickname: '자바스크립트요정', avatar },
      authorRevealed,
      presentationOrder: 2,
    },
    answers: [{
      id: '33333333-3333-4333-8333-333333333333',
      content: '후보 목록에는 있지만 발표 DTO에는 없어야 해요.',
      submittedAt: '2026-08-30T08:00:00.000Z',
      updatedAt: '2026-08-30T08:00:00.000Z',
      status: 'current',
      presentationOrder: 2,
      author: { nickname: '자바스크립트요정', avatar },
    }],
  });
}

describe('projector presentation DTO', () => {
  it('returns only question, revision, updatedAt and a waiting slide before selection', () => {
    const screen = buildPresentationScreenView(controllerView());

    expect(screen).toEqual({
      question: {
        id: '11111111-1111-4111-8111-111111111111',
        prompt: '기억에 남는 순간은?',
      },
      revision: 0,
      updatedAt: null,
      slide: { kind: 'waiting' },
    });
    expect(Object.keys(screen).sort()).toEqual(['question', 'revision', 'slide', 'updatedAt']);
  });

  it('omits the author key itself and every controller-only field while anonymous', () => {
    const screen = buildPresentationScreenView(currentControllerView(false));

    expect(screen).toEqual({
      question: {
        id: '11111111-1111-4111-8111-111111111111',
        prompt: '기억에 남는 순간은?',
      },
      revision: 7,
      updatedAt: '2026-08-30T09:10:11.000Z',
      slide: {
        kind: 'answer',
        content: '서로의 코드를 보며\n웃었던 순간 ✨',
      },
    });
    expect(Object.hasOwn(screen.slide, 'author')).toBe(false);
    expect(JSON.stringify(screen)).not.toMatch(/answerId|itemId|currentItemId|answers|summary|presentationOrder/);
    expect(JSON.stringify(screen)).not.toContain('자바스크립트요정');
  });

  it('adds exactly the snapshotted nickname and avatar after author reveal', () => {
    const screen = buildPresentationScreenView(currentControllerView(true));

    expect(screen.slide).toEqual({
      kind: 'answer',
      content: '서로의 코드를 보며\n웃었던 순간 ✨',
      author: { nickname: '자바스크립트요정', avatar },
    });
    expect(Object.keys(screen.slide).sort()).toEqual(['author', 'content', 'kind']);
  });
});

describe('presentation log boundary', () => {
  it('redacts presentation snapshots and identity fields recursively', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    try {
      logger.info('presentation_security_test', {
        snapshotContent: 'snapshot-content-never-log',
        snapshotNickname: 'snapshot-nickname-never-log',
        snapshotAvatar: { traits: { hair: 'snapshot-avatar-never-log' } },
        author: { nickname: 'author-nickname-never-log' },
        avatar: { traits: { outfit: 'avatar-trait-never-log' } },
        revision: 9,
      });

      const line = String(output.mock.calls[0]?.[0]);
      expect(line).toContain('[REDACTED]');
      expect(line).toContain('"revision":9');
      for (const secret of [
        'snapshot-content-never-log',
        'snapshot-nickname-never-log',
        'snapshot-avatar-never-log',
        'author-nickname-never-log',
        'avatar-trait-never-log',
      ]) expect(line).not.toContain(secret);
    } finally {
      output.mockRestore();
    }
  });

  it('allowlists presentation command logs to the finite command type', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    try {
      logger.presentationCommand({
        type: 'select_answer',
        answerId: 'answer-id-never-log',
        content: 'answer-content-never-log',
        nickname: 'nickname-never-log',
        unexpected: 'unexpected-value-never-log',
      });

      const payload = JSON.parse(String(output.mock.calls[0]?.[0]));
      expect(payload).toMatchObject({
        level: 'info',
        event: 'presentation_command',
        details: { commandType: 'select_answer' },
      });
      expect(Object.keys(payload.details)).toEqual(['commandType']);
      expect(JSON.stringify(payload)).not.toMatch(/answer-id-never-log|answer-content-never-log|nickname-never-log|unexpected-value-never-log/);
    } finally {
      output.mockRestore();
    }
  });
});
