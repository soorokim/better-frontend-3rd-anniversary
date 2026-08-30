import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOG_VERSION, avatarCatalog } from '@/lib/avatar/catalog';
import { generateAvatar } from '@/lib/avatar/generator';

describe('pixel avatar generator', () => {
  it('returns the same independently selected traits 100 times', () => {
    const first = generateAvatar('nickname-key-v1', 'frontend');
    for (let index = 0; index < 100; index += 1) {
      expect(generateAvatar('nickname-key-v1', 'frontend')).toEqual(first);
    }
    expect(first).toMatchInlineSnapshot(`
      {
        "catalogVersion": "pixel-parts-v1",
        "generatorVersion": "avatar-generator-v1",
        "sourceDigest": "dcef7653fef2f92efaa954227e0afbea26a843bde93760cd94abe6ef99318ef7",
        "traits": {
          "accent": "yellow",
          "accessory": "terminal",
          "body": "warm",
          "hair": "cap",
          "outfit": "sweater",
        },
      }
    `);
  });

  it('keeps every generated part inside the versioned catalog', () => {
    expect(AVATAR_CATALOG_VERSION).toBe('pixel-parts-v1');
    for (const nickname of ['민지', 'frontend', '야간작업자', '🧑🏻‍💻']) {
      const avatar = generateAvatar('nickname-key-v1', nickname);
      for (const [trait, value] of Object.entries(avatar.traits)) {
        expect(avatarCatalog[trait as keyof typeof avatarCatalog]).toContain(value);
      }
    }
  });

  it('changes the output namespace when a source version changes', () => {
    expect(generateAvatar('nickname-key-v1', 'frontend')).not.toEqual(
      generateAvatar('conversation-v1', 'frontend'),
    );
  });
});
