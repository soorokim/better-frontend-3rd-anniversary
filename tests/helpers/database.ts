import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@/db/schema';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export async function createTestDatabase() {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL이 필요합니다.');
  const client = postgres(TEST_DATABASE_URL, { max: 1, prepare: false });
  const database = drizzle(client, { schema });
  try {
    // Drizzle records applied migrations in its own schema. Recreating only
    // public leaves stale history behind, so the next test file skips every
    // migration and receives an empty database.
    await client.begin(async (sql) => {
      await sql`drop schema if exists public cascade`;
      await sql`drop schema if exists drizzle cascade`;
      await sql`create schema public`;
    });
    await migrate(database, { migrationsFolder: './db/migrations' });
  } catch (error) {
    await client.end();
    throw error;
  }
  return {
    db: database,
    client,
    async reset() {
      await client`truncate table presentation_items, presentation_sessions, audit_events, auth_throttles, pin_reset_grants, admin_sessions, participant_sessions, answers, questions, conversation_profile_aliases, conversation_profiles, conversation_profile_batches, avatar_assignments, participants, admin_accounts, events restart identity cascade`;
    },
    async close() { await client.end(); },
  };
}
