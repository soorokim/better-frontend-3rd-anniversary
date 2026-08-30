import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@/db/schema';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export async function createTestDatabase() {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL이 필요합니다.');
  const client = postgres(TEST_DATABASE_URL, { max: 1, prepare: false });
  const database = drizzle(client, { schema });
  await client`drop schema if exists public cascade`;
  await client`create schema public`;
  await migrate(database, { migrationsFolder: './db/migrations' });
  return { db: database, client, async reset() { await client`truncate table audit_events, auth_throttles, pin_reset_grants, admin_sessions, participant_sessions, answers, questions, avatar_assignments, participants, admin_accounts, events restart identity cascade`; }, async close() { await client.end(); } };
}
