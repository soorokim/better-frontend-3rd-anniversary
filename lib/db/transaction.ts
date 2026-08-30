import { db as database } from './client';
import type { PgTransactionConfig } from 'drizzle-orm/pg-core';

export type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

export function inTransaction<T>(
  work: (tx: Transaction) => Promise<T>,
  config?: PgTransactionConfig,
): Promise<T> {
  return database.transaction(work, config);
}
