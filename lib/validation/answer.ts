import { z } from 'zod';

export const answerSchema = z.string().trim().min(1, '답변을 입력해 주세요.').max(1000, '답변은 1,000자까지 입력할 수 있습니다.');
export const answerRequestSchema = z.object({ questionId: z.string().uuid().optional(), content: answerSchema }).strict();
