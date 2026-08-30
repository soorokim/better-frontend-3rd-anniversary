import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import {
  avatarAssignments,
  participants,
  presentationItems,
  presentationSessions,
} from '@/db/schema';
import { closeDatabase } from '@/lib/db/client';
import { preparePresentationSession } from '@/lib/db/repositories/presentation';
import { commandPresentation } from '@/lib/presentation/presentation-service';
import { createTestDatabase } from '@/tests/helpers/database';
import { assertDisposableTestDatabaseUrl, TEST_DATABASE_URL } from '@/tests/helpers/database';
import {
  answerFactory,
  eventFactory,
  participantFactory,
  questionFactory,
} from '@/tests/helpers/factories';

async function migrationFixture(tags: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'avatar-migrations-'));
  await mkdir(join(root, 'meta'));
  const journal = JSON.parse(await readFile('db/migrations/meta/_journal.json', 'utf8')) as {
    version: string;
    dialect: string;
    entries: Array<{ idx: number; tag: string }>;
  };
  const entries = journal.entries.filter((entry) => tags.includes(entry.tag));
  expect(entries.map((entry) => entry.tag)).toEqual(tags);
  await writeFile(join(root, 'meta', '_journal.json'), JSON.stringify({
    version: journal.version,
    dialect: journal.dialect,
    entries,
  }));
  for (const tag of tags) {
    await cp(join('db', 'migrations', `${tag}.sql`), join(root, `${tag}.sql`));
  }
  return root;
}

async function preservedPresentationState(client: postgres.Sql) {
  const [counts] = await client<{
    participants: number;
    answers: number;
    sessions: number;
    items: number;
  }[]>`
    select
      (select count(*)::int from participants) as participants,
      (select count(*)::int from answers) as answers,
      (select count(*)::int from presentation_sessions) as sessions,
      (select count(*)::int from presentation_items) as items
  `;
  const [session] = await client<{
    current_item_id: string;
    author_revealed: boolean;
    revision: number;
  }[]>`select current_item_id, author_revealed, revision from presentation_sessions`;
  const [item] = await client<{
    id: string;
    presentation_order: number;
    avatar_snapshot: Record<string, unknown>;
  }[]>`select id, presentation_order, avatar_snapshot from presentation_items`;
  return { counts, session, item };
}

describe('presentation command concurrency', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let eventId: string;

  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => {
    await database.reset();
    const event = await eventFactory(database.db, { slug: 'presenter-concurrency' });
    eventId = event.id;
    const question = await questionFactory(database.db, event.id);

    for (const nickname of ['동시진행자A', '동시진행자B', '동시진행자C']) {
      const participant = await participantFactory(database.db, event.id, {
        nicknameDisplay: nickname,
        nicknameKey: nickname.toLowerCase(),
      });
      const [avatar] = await database.db.insert(avatarAssignments).values({
        participantId: participant.id,
        sourceKind: 'nickname',
        sourceVersion: 'nickname-key-v1',
        sourceDigest: `digest-${nickname}`,
        generatorVersion: 'avatar-v1',
        catalogVersion: 'pixel-parts-v1',
        selectedTraits: {
          hair: 'bob',
          body: 'warm',
          outfit: 'hoodie',
          accessory: 'none',
          accent: 'pink',
        },
      }).returning();
      await database.db.update(participants)
        .set({ currentAvatarId: avatar.id })
        .where(eq(participants.id, participant.id));
      await answerFactory(database.db, participant.id, question.id, {
        content: `${nickname}의 동시 공개 답변`,
      });
    }

    await preparePresentationSession(event.id);
  });
  afterAll(async () => {
    await closeDatabase();
    await database?.close();
  });

  it('serializes two random selections without duplicate answers or presentation orders', async () => {
    const results = await Promise.all([
      commandPresentation(eventId, { type: 'select_random' }),
      commandPresentation(eventId, { type: 'select_random' }),
    ]);

    const rows = await database.db.select().from(presentationItems)
      .orderBy(asc(presentationItems.presentationOrder));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.answerId)).size).toBe(2);
    expect(rows.map((row) => row.presentationOrder)).toEqual([1, 2]);

    const revisions = results.map((result) => result.session.revision).sort((a, b) => a - b);
    expect(revisions).toEqual([1, 2]);
    const [session] = await database.db.select().from(presentationSessions)
      .where(eq(presentationSessions.eventId, eventId));
    expect(session.revision).toBe(2);
    expect(session.currentItemId).toBe(rows[1].id);
    expect(results.find((result) => result.session.revision === 2)?.currentSlide?.answerId)
      .toBe(rows[1].answerId);
  });
});

describe.skipIf(!TEST_DATABASE_URL)('conversation profile migration upgrade', () => {
  it('preserves participant, answer, and presenter state while applying 0003 twice', async () => {
    assertDisposableTestDatabaseUrl(TEST_DATABASE_URL!);
    const client = postgres(TEST_DATABASE_URL!, { max: 1, prepare: false });
    const database = drizzle(client);
    let baselineMigrations: string | undefined;
    let allMigrations: string | undefined;
    try {
      await client.begin(async (sql) => {
        await sql`drop schema if exists public cascade`;
        await sql`drop schema if exists drizzle cascade`;
        await sql`create schema public`;
      });
      baselineMigrations = await migrationFixture(['0001_event_core', '0002_presenter_results']);
      await migrate(database, { migrationsFolder: baselineMigrations });

      const [event] = await client<{ id: string }[]>`
        insert into events (slug, title, invite_code_hash)
        values ('upgrade-test', '업그레이드 테스트', 'fixture-hash') returning id
      `;
      const [participant] = await client<{ id: string }[]>`
        insert into participants (event_id, nickname_display, nickname_key, pin_hash)
        values (${event.id}, 'fixture-participant', 'fixture-participant', 'fixture-pin-hash') returning id
      `;
      const [avatar] = await client<{ id: string }[]>`
        insert into avatar_assignments (
          participant_id, source_kind, source_version, source_digest,
          generator_version, catalog_version, selected_traits
        ) values (
          ${participant.id}, 'nickname', 'nickname-key-v1', 'fixture-avatar-digest',
          'avatar-v1', 'pixel-parts-v1', ${JSON.stringify({ hair: 'bob', outfit: 'hoodie' })}::jsonb
        ) returning id
      `;
      await client`update participants set current_avatar_id = ${avatar.id} where id = ${participant.id}`;
      const [question] = await client<{ id: string }[]>`
        insert into questions (event_id, prompt, status, published_at)
        values (${event.id}, 'fixture-question', 'published', now()) returning id
      `;
      const [answer] = await client<{ id: string; updated_at: Date }[]>`
        insert into answers (participant_id, question_id, content)
        values (${participant.id}, ${question.id}, 'fixture-answer') returning id, updated_at
      `;
      const [session] = await client<{ id: string }[]>`
        insert into presentation_sessions (event_id, question_id, author_revealed, revision)
        values (${event.id}, ${question.id}, true, 7) returning id
      `;
      const [item] = await client<{ id: string }[]>`
        insert into presentation_items (
          presentation_session_id, answer_id, content_snapshot,
          answer_updated_at_snapshot, nickname_snapshot, avatar_snapshot, presentation_order
        ) values (
          ${session.id}, ${answer.id}, 'fixture-answer', ${answer.updated_at},
          'fixture-participant',
          ${JSON.stringify({ generatorVersion: 'avatar-v1', catalogVersion: 'pixel-parts-v1', traits: { hair: 'bob', outfit: 'hoodie' } })}::jsonb,
          1
        ) returning id
      `;
      await client`
        update presentation_sessions set current_item_id = ${item.id}
        where id = ${session.id}
      `;
      const before = await preservedPresentationState(client);

      allMigrations = await migrationFixture([
        '0001_event_core',
        '0002_presenter_results',
        '0003_conversation_profiles',
      ]);
      await migrate(database, { migrationsFolder: allMigrations });
      const after = await preservedPresentationState(client);
      expect(after).toEqual(before);

      const [enumValue] = await client<{ enumlabel: string }[]>`
        select enumlabel from pg_enum
        join pg_type on pg_type.oid = pg_enum.enumtypid
        where pg_type.typname = 'throttle_action' and enumlabel = 'participant_register'
      `;
      expect(enumValue?.enumlabel).toBe('participant_register');
      expect(await client`select 1 from conversation_profile_batches limit 0`).toEqual([]);

      await migrate(database, { migrationsFolder: allMigrations });
      expect(await preservedPresentationState(client)).toEqual(before);
    } finally {
      await client.end();
      if (baselineMigrations) await rm(baselineMigrations, { recursive: true, force: true });
      if (allMigrations) await rm(allMigrations, { recursive: true, force: true });
    }
  });
});
