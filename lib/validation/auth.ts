import { z } from 'zod';

export const pinSchema = z.string().regex(/^\d{6}$/, 'PIN은 숫자 6자리여야 합니다.');
export const resetCodeSchema = z.string().regex(/^\d{8}$/, '초기화 코드는 숫자 8자리여야 합니다.');
export const registerSchema = z.object({
  inviteCode: z.string().min(16), nickname: z.string(), pin: pinSchema, pinConfirmation: pinSchema,
}).strict().refine(({ pin, pinConfirmation }) => pin === pinConfirmation, { path: ['pinConfirmation'], message: 'PIN이 서로 다릅니다.' });

export const loginSchema = z.object({
  inviteCode: z.string().min(16), nickname: z.string(), pin: pinSchema,
}).strict();
