import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { conversationProfileAliases, conversationProfileBatches, conversationProfiles } from '@/db/schema';
import { importConversationProfiles } from '@/scripts/import-conversation-profiles';
import { createTestDatabase } from '@/tests/helpers/database';
import { eventFactory, participantFactory } from '@/tests/helpers/factories';

describe('conversation profile batch import', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let directory: string;
  let event: Awaited<ReturnType<typeof eventFactory>>;
  beforeAll(async () => { database = await createTestDatabase(); directory = await mkdtemp(join(tmpdir(), 'avatar-import-')); });
  beforeEach(async () => { await database.reset(); event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' }); });
  afterAll(async () => { await database?.close(); await rm(directory, { recursive: true, force: true }); });

  async function fixture(overrides: Record<string, unknown> = {}) {
    const payload = JSON.parse(await readFile('tests/fixtures/avatar-analysis/valid-all-participants.json', 'utf8'));
    Object.assign(payload, overrides);
    const path = join(directory, `${crypto.randomUUID()}.json`);
    await writeFile(path, JSON.stringify(payload), 'utf8');
    return path;
  }

  it('prevalidates, imports in one active batch, and treats the same payload as idempotent', async () => {
    const path = await fixture();
    const first = await importConversationProfiles(path);
    const second = await importConversationProfiles(path);
    expect(first).toMatchObject({ imported: 1, stored: 1, idempotent: false });
    expect(second).toMatchObject({ imported: 0, stored: 1, idempotent: true, batchId: first.batchId });
    expect(await database.db.select().from(conversationProfileBatches)).toHaveLength(1);
    expect(await database.db.select().from(conversationProfiles)).toHaveLength(1);
    expect(await database.db.select().from(conversationProfileAliases)).toHaveLength(2);
  });

  it('rejects row-count mismatches and unresolved review data before storing a batch', async () => {
    const mismatch = await fixture({ source_user_count: 3 });
    await expect(importConversationProfiles(mismatch)).rejects.toThrow();
    const original = JSON.parse(await readFile('tests/fixtures/avatar-analysis/valid-all-participants.json', 'utf8'));
    original.merge_review = [{ nickname_key: 'duplicate', source_users: [
      { user_id: 1, display_name: 'Dup', message_count: 2 },
      { user_id: 2, display_name: 'Ｄｕｐ', message_count: 3 },
    ] }];
    const review = join(directory, `${crypto.randomUUID()}.json`);
    await writeFile(review, JSON.stringify(original), 'utf8');
    await expect(importConversationProfiles(review)).rejects.toThrow();
    expect(await database.db.select().from(conversationProfileBatches)).toHaveLength(0);
  });

  it('rejects original user ids embedded in a supposedly clean profile', async () => {
    const payload = JSON.parse(await readFile('tests/fixtures/avatar-analysis/valid-all-participants.json', 'utf8'));
    payload.profiles[0].user_id = 99;
    const path = join(directory, `${crypto.randomUUID()}.json`);
    await writeFile(path, JSON.stringify(payload), 'utf8');
    await expect(importConversationProfiles(path)).rejects.toThrow();
    expect(await database.db.select().from(conversationProfileBatches)).toHaveLength(0);
  });

  it('keeps the superseded batch and moves an existing claim to the new active profile', async () => {
    await importConversationProfiles(await fixture());
    const participant = await participantFactory(database.db, event.id, {
      nicknameDisplay: '예시개발자', nicknameKey: '예시개발자',
    });
    const [oldProfile] = await database.db.select().from(conversationProfiles);
    await database.db.update(conversationProfiles).set({ claimedParticipantId: participant.id, claimedAt: new Date() })
      .where(eq(conversationProfiles.id, oldProfile.id));
    const payload = JSON.parse(await readFile('tests/fixtures/avatar-analysis/valid-all-participants.json', 'utf8'));
    payload.profiles[0].conversation_digest = 'b'.repeat(64);
    const nextPath = join(directory, `${crypto.randomUUID()}.json`);
    await writeFile(nextPath, JSON.stringify(payload), 'utf8');
    await importConversationProfiles(nextPath);

    const batches = await database.db.select().from(conversationProfileBatches);
    expect(batches.map((batch) => batch.status).sort()).toEqual(['active', 'superseded']);
    const profiles = await database.db.select().from(conversationProfiles);
    expect(profiles).toHaveLength(2);
    expect(profiles.find((profile) => profile.sourceDigest === 'a'.repeat(64))?.claimedParticipantId).toBeNull();
    expect(profiles.find((profile) => profile.sourceDigest === 'b'.repeat(64))?.claimedParticipantId).toBe(participant.id);
  });
});
