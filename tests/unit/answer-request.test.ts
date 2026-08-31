import { describe, expect, it } from 'vitest';
import { answerRequestSchema } from '@/lib/validation/answer';

describe('multi-question answer request', () => {
  const questionId = '00000000-0000-4000-8000-000000000001';

  it('accepts a question-specific answer for the four-question form', () => {
    expect(answerRequestSchema.safeParse({ questionId, content: '올해 정말 좋았던 일이 있었어요.' }).success).toBe(true);
  });

  it('keeps the original single-question request shape compatible', () => {
    expect(answerRequestSchema.safeParse({ content: '기존 참가자 흐름도 유지합니다.' }).success).toBe(true);
  });

  it('rejects malformed question IDs and blank answers', () => {
    expect(answerRequestSchema.safeParse({ questionId: 'not-a-uuid', content: '내용' }).success).toBe(false);
    expect(answerRequestSchema.safeParse({ questionId, content: '   ' }).success).toBe(false);
  });
});
