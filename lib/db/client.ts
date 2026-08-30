import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '@/lib/config/env';
import * as schema from '@/db/schema';

type SqlClient = ReturnType<typeof postgres>;
type Database = PostgresJsDatabase<typeof schema>;
const globalDb = globalThis as unknown as { sqlClient?: SqlClient; database?: Database };

function getSqlClient(): SqlClient {
  if (!globalDb.sqlClient) globalDb.sqlClient = postgres(getEnv().DATABASE_URL, { max: 10, prepare: false });
  return globalDb.sqlClient;
}

function getDatabase(): Database {
  if (!globalDb.database) globalDb.database = drizzle(getSqlClient(), { schema });
  return globalDb.database;
}

// Importing a route during `next build` must not require production secrets.
// The proxy initializes the validated runtime configuration on first DB use.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = getDatabase();
    const value = Reflect.get(database, property);
    return typeof value === 'function' ? value.bind(database) : value;
  },
});

export async function databaseHealthCheck(): Promise<void> {
  await getSqlClient()`select 1`;
}

export async function closeDatabase(): Promise<void> {
  if (globalDb.sqlClient) await globalDb.sqlClient.end();
  globalDb.sqlClient = undefined;
  globalDb.database = undefined;
}
