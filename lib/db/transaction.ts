import { db as database } from './client';

export type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

export function inTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  return database.transaction(work);
}
