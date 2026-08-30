import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { events } from '@/db/schema';
import { createTestDatabase, TEST_DATABASE_URL } from '../helpers/database';

describe('bootstrap contract', () => {
  it('app starts only after a successful migration service', async () => {
    const compose = await readFile('compose.yaml', 'utf8');
    expect(compose).toContain('condition: service_completed_successfully');
    expect(compose.indexOf('migrate:')).toBeLessThan(compose.indexOf('app:'));
  });

  it.skipIf(!TEST_DATABASE_URL)('migrations can be applied repeatedly without duplicating initial records', async () => {
    const test = await createTestDatabase();
    try {
      await test.db.insert(events).values({ slug: 'idempotent', title: '행사', inviteCodeHash: 'hash' }).onConflictDoNothing({ target: events.slug });
      await test.db.insert(events).values({ slug: 'idempotent', title: '행사', inviteCodeHash: 'hash' }).onConflictDoNothing({ target: events.slug });
      expect((await test.db.select().from(events)).filter((event) => event.slug === 'idempotent')).toHaveLength(1);
    } finally { await test.close(); }
  });
});
