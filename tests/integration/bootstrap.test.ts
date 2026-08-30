import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import {
  conversationProfileAliases,
  conversationProfileBatches,
  conversationProfiles,
  events,
} from '@/db/schema';
import {
  assertDisposableTestDatabaseUrl,
  createTestDatabase,
  TEST_DATABASE_URL,
} from '../helpers/database';

const expectedMigrationTags = [
  '0001_event_core',
  '0002_presenter_results',
  '0003_conversation_profiles',
];

describe('bootstrap contract', () => {
  it('app starts only after a successful migration service', async () => {
    const compose = await readFile('compose.yaml', 'utf8');
    expect(compose).toContain('condition: service_completed_successfully');
    expect(compose.indexOf('migrate:')).toBeLessThan(compose.indexOf('app:'));
  });

  it('uses the same migration runner after a validated pre-upgrade backup', async () => {
    const [compose, deploy, backup, restore] = await Promise.all([
      readFile('compose.yaml', 'utf8'),
      readFile('scripts/deploy.sh', 'utf8'),
      readFile('scripts/backup.ps1', 'utf8'),
      readFile('scripts/restore.ps1', 'utf8'),
    ]);
    expect(compose).toContain('npm run db:migrate');
    expect(deploy).toContain('docker compose run --rm migrate');
    expect(deploy.indexOf('pg_restore --list')).toBeLessThan(
      deploy.indexOf('docker compose run --rm migrate'),
    );
    expect(backup).toContain("'pg_restore', '--list'");
    expect(restore.indexOf("$backupScript = Join-Path $PSScriptRoot 'backup.ps1'"))
      .toBeLessThan(restore.indexOf("'dropdb', '--username'"));
    expect(restore).not.toContain('docker compose down -v');
  });

  it('keeps one ordered migration file and journal entry per deployed feature', async () => {
    const journal = JSON.parse(await readFile('db/migrations/meta/_journal.json', 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const migrationFiles = (await readdir('db/migrations'))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    expect(journal.entries.map(({ idx, tag }) => ({ idx, tag }))).toEqual(
      expectedMigrationTags.map((tag, idx) => ({ idx, tag })),
    );
    expect(migrationFiles).toEqual(expectedMigrationTags.map((tag) => `${tag}.sql`));

    const conversationMigration = await readFile(
      'db/migrations/0003_conversation_profiles.sql',
      'utf8',
    );
    expect(conversationMigration).toMatch(
      /ALTER TYPE\s+"?throttle_action"?\s+ADD VALUE(?: IF NOT EXISTS)?\s+'participant_register'/i,
    );
    expect(conversationMigration.match(/'participant_register'/g)).toHaveLength(1);
  });

  it('refuses to reset a remote or non-test database', () => {
    expect(() => assertDisposableTestDatabaseUrl('postgresql://user:pass@db.example/event'))
      .toThrow(/삭제 가능한 DB/);
    expect(() => assertDisposableTestDatabaseUrl('postgresql://user:pass@127.0.0.1/event'))
      .toThrow(/삭제 가능한 DB/);
    expect(() => assertDisposableTestDatabaseUrl('postgresql://user:pass@127.0.0.1/avatar_test'))
      .not.toThrow();
  });

  it.skipIf(!TEST_DATABASE_URL)('migrations can be applied repeatedly without duplicating initial records', async () => {
    const test = await createTestDatabase();
    try {
      await migrate(test.db, { migrationsFolder: './db/migrations' });
      await test.db.insert(events).values({ slug: 'idempotent', title: '행사', inviteCodeHash: 'hash' }).onConflictDoNothing({ target: events.slug });
      await test.db.insert(events).values({ slug: 'idempotent', title: '행사', inviteCodeHash: 'hash' }).onConflictDoNothing({ target: events.slug });
      expect((await test.db.select().from(events)).filter((event) => event.slug === 'idempotent')).toHaveLength(1);
      expect(await test.db.select().from(conversationProfileBatches)).toEqual([]);
      expect(await test.db.select().from(conversationProfiles)).toEqual([]);
      expect(await test.db.select().from(conversationProfileAliases)).toEqual([]);

      const tables = await test.client<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (
            'presentation_sessions',
            'presentation_items',
            'conversation_profile_batches',
            'conversation_profiles',
            'conversation_profile_aliases'
          )
        order by table_name
      `;
      expect(tables.map((row) => row.table_name)).toEqual([
        'conversation_profile_aliases',
        'conversation_profile_batches',
        'conversation_profiles',
        'presentation_items',
        'presentation_sessions',
      ]);
      const actions = await test.client<{ enumlabel: string }[]>`
        select enumlabel
        from pg_enum
        join pg_type on pg_type.oid = pg_enum.enumtypid
        where pg_type.typname = 'throttle_action'
        order by enumsortorder
      `;
      expect(actions.map((row) => row.enumlabel)).toContain('participant_register');
    } finally { await test.close(); }
  });
});
