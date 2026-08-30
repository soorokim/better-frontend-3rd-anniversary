import { ZodError } from 'zod';
import { logger } from '@/lib/observability/logger';

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public field?: string, public retryAfter?: number) { super(message); }
}
export class UnauthorizedError extends AppError { constructor() { super('unauthorized', '다시 로그인해 주세요.', 401); } }
export class ForbiddenError extends AppError { constructor() { super('forbidden', '이 작업을 수행할 권한이 없습니다.', 403); } }

export function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return Response.json({ error: { code: 'validation_error', message: issue?.message ?? '입력값을 확인해 주세요.', field: issue?.path.join('.') || undefined } }, { status: 400 });
  }
  if (error instanceof AppError) return Response.json(
    { error: { code: error.code, message: error.message, field: error.field } },
    { status: error.status, headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined },
  );
  logger.error('request_failed', error);
  return Response.json({ error: { code: 'internal_error', message: '잠시 후 다시 시도해 주세요.' } }, { status: 500 });
}
