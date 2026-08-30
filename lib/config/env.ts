import { readFileSync } from 'node:fs';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  AUTH_PEPPER: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  EVENT_SLUG: z.string().min(1).max(80).default('frontend-chat-3rd'),
  EVENT_TITLE: z.string().min(1).max(100).default('프론트엔드 단톡방 3주년'),
  EVENT_QUESTION: z.string().trim().min(1).max(500),
  INVITE_CODE: z.string().min(16),
  ADMIN_USERNAME: z.string().min(1).max(80),
  ADMIN_PASSWORD: z.string().min(15),
});

export type AppEnv = z.infer<typeof schema>;
let cached: AppEnv | undefined;

function value(name: string): string | undefined {
  const file = process.env[`${name}_FILE`];
  return file ? readFileSync(file, 'utf8').trim() : process.env[name];
}

export function getEnv(): AppEnv {
  if (!cached) {
    cached = schema.parse({
      ...process.env,
      DATABASE_URL: value('DATABASE_URL'),
      AUTH_PEPPER: value('AUTH_PEPPER'),
      SESSION_SECRET: value('SESSION_SECRET'),
      INVITE_CODE: value('INVITE_CODE'),
      ADMIN_USERNAME: value('ADMIN_USERNAME'),
      ADMIN_PASSWORD: value('ADMIN_PASSWORD'),
      EVENT_QUESTION: value('EVENT_QUESTION'),
    });
  }
  return cached;
}
