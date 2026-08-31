import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixture from '@/tests/fixtures/avatar-assignments-v1.json';
import { avatarCatalog, AVATAR_CATALOG_VERSION } from '@/lib/avatar/catalog';
import { generateAvatar, AVATAR_GENERATOR_VERSION } from '@/lib/avatar/generator';

describe('avatar assignment regression', () => {
  it('keeps catalog versions, identifiers and identifier order frozen', () => {
    expect(AVATAR_CATALOG_VERSION).toBe(fixture.catalogVersion);
    expect(AVATAR_GENERATOR_VERSION).toBe(fixture.generatorVersion);
    expect(avatarCatalog).toEqual(fixture.catalog);

    const combinations = Object.values(avatarCatalog).reduce(
      (count, values) => count * values.length,
      1,
    );
    expect(combinations).toBe(fixture.matrix.count);
  });

  it.each(fixture.cases)('preserves $sourceVersion/$source', (entry) => {
    expect(generateAvatar(entry.sourceVersion, entry.source)).toEqual({
      sourceDigest: entry.sourceDigest,
      generatorVersion: entry.generatorVersion,
      catalogVersion: entry.catalogVersion,
      traits: entry.traits,
    });
  });

  it('preserves the deterministic 1,200-source assignment matrix', () => {
    const assignments = Array.from({ length: fixture.matrix.count }, (_, index) =>
      generateAvatar(
        fixture.matrix.sourceVersion,
        `${fixture.matrix.sourcePrefix}${String(index).padStart(4, '0')}`,
      ),
    );
    const digest = createHash('sha256').update(JSON.stringify(assignments)).digest('hex');
    expect(digest).toBe(fixture.matrix.sha256);
  });
});
