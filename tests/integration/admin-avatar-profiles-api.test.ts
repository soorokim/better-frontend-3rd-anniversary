import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { issueSession } from '@/lib/auth/session';
import { createTestDatabase } from '@/tests/helpers/database';
import { conversationProfileBatchFactory } from '@/tests/helpers/conversation-profiles';
import { adminFactory, eventFactory } from '@/tests/helpers/factories';

let adminCookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => adminCookie ? { value: adminCookie } : undefined }) }));

describe('admin avatar profile API', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => { await database.reset(); adminCookie = undefined; });
  afterAll(async () => database?.close());

  it('requires an admin and returns only batch counts, aliases, and claim status', async () => {
    const event = await eventFactory(database.db);
    const admin = await adminFactory(database.db, event.id);
    await conversationProfileBatchFactory(database.db, event.id, [{ nickname: '대표닉', aliases: ['예전닉'], sourceRowCount: 2 }]);
    const { GET } = await import('@/app/api/admin/avatar-profiles/route');
    expect((await GET()).status).toBe(401);
    adminCookie = (await issueSession('admin', admin.id, admin.authVersion)).token;
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      activeBatch: { sourceUserCount: 2, profileCount: 1 },
      counts: { ready: 1, claimed: 0, mergedSourceRows: 2 },
      profiles: [{ nickname: '대표닉', aliases: ['대표닉', '예전닉'], sourceRowCount: 2, claimed: false }],
    });
    const serialized = JSON.stringify(body);
    for (const forbidden of ['conversation_digest', 'sourceDigest', 'user_id', 'messages']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
