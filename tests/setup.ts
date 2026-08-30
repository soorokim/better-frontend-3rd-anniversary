import '@testing-library/jest-dom/vitest';

// Route modules and destructive test helpers must always point at the same,
// explicitly isolated database when integration tests provide one.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? 'postgresql://frontend_chat:change-me@127.0.0.1:5432/frontend_chat_test';
// API request fixtures use this origin. Do not inherit a deployed server's
// APP_ORIGIN because production origin checks must remain strict.
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.AUTH_PEPPER ??= 'test-pepper-0123456789abcdef0123456789';
process.env.SESSION_SECRET ??= 'test-session-0123456789abcdef01234567';
process.env.INVITE_CODE ??= 'test-invite-code-1234';
process.env.ADMIN_USERNAME ??= 'host';
process.env.ADMIN_PASSWORD ??= 'test-admin-password-long';
process.env.EVENT_QUESTION ??= '기억에 남는 순간은 무엇인가요?';
