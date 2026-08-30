import { z } from 'zod';
import { nicknameSchema } from './nickname';

export const pinSchema = z.string().regex(/^\d{6}$/, 'PIN은 숫자 6자리여야 합니다.');
export const invitationSchema = z.object({ inviteCode: z.string().min(16) }).strict();
export const resetCodeSchema = z.string().regex(/^\d{8}$/, '초기화 코드는 숫자 8자리여야 합니다.');
export const registerSchema = z.object({
  inviteCode: z.string().min(16), nickname: nicknameSchema, pin: pinSchema, pinConfirmation: pinSchema,
}).strict().refine(({ pin, pinConfirmation }) => pin === pinConfirmation, { path: ['pinConfirmation'], message: 'PIN이 서로 다릅니다.' });

export const loginSchema = z.object({
  inviteCode: z.string().min(16), nickname: nicknameSchema, pin: pinSchema,
}).strict();

export const adminLoginSchema = z.object({ username: z.string().min(1).max(80), password: z.string().min(15) }).strict();
export const adminReauthenticationSchema = z.object({ password: z.string().min(15).optional() }).strict();
export const completePinResetSchema = z.object({
  inviteCode: z.string().min(16), nickname: nicknameSchema, resetCode: resetCodeSchema,
  newPin: pinSchema, newPinConfirmation: pinSchema,
}).strict().refine(({ newPin, newPinConfirmation }) => newPin === newPinConfirmation, { path: ['newPinConfirmation'], message: 'PIN이 서로 다릅니다.' });
