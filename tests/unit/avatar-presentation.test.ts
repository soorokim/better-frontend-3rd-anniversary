import { describe, expect, it } from 'vitest';
import { renderPixelAvatar } from '@/lib/avatar/dicebear';
import {
  FULL_BODY_AVATAR_ATLAS,
  fullBodyAvatarSprite,
  fullBodyAvatarUrl,
  normalizeAvatarTraits,
  pixelAvatarUrl,
} from '@/lib/avatar/presentation';

describe('pixel avatar presentation', () => {
  const traits = {
    body: 'warm',
    hair: 'cap',
    outfit: 'sweater',
    accessory: 'terminal',
    accent: 'yellow',
  };

  it('builds a stable self-hosted image URL', () => {
    expect(pixelAvatarUrl(traits)).toBe(
      '/avatars/pixel-art?body=warm&hair=cap&outfit=sweater&accessory=terminal&accent=yellow',
    );
  });

  it('falls back safely when stored traits are missing or unknown', () => {
    expect(normalizeAvatarTraits({ hair: 'unknown' })).toEqual({
      body: 'warm',
      hair: 'short',
      outfit: 'hoodie',
      accessory: 'none',
      accent: 'yellow',
    });
  });

  it('renders the same crisp DiceBear SVG for the same traits', () => {
    const normalized = normalizeAvatarTraits(traits);
    const first = renderPixelAvatar(normalized);
    const second = renderPixelAvatar(normalized);

    expect(second).toBe(first);
    expect(first).toContain('<svg');
    expect(first).toContain('shape-rendering="crispEdges"');
    expect(first).toContain('viewBox="0 0 16 16"');
  });

  it('selects one stable full-body sprite and keeps its asset self-hosted', () => {
    const profile = { ...traits, developerItem: 'RUBBER DUCK', developerHash: '7A3F-C921' };
    expect(fullBodyAvatarSprite(profile)).toEqual({ index: 2, column: 2, row: 0 });
    expect(fullBodyAvatarSprite(profile)).toEqual(fullBodyAvatarSprite(profile));
    expect(fullBodyAvatarUrl(profile)).toBe(`${FULL_BODY_AVATAR_ATLAS}?sprite=2`);
  });

  it('keeps every fallback selection inside the 4 by 4 atlas', () => {
    for (const developerHash of ['0000-0000', '7A3F-C921', 'FFFF-FFFF']) {
      const sprite = fullBodyAvatarSprite({ ...traits, developerHash });
      expect(sprite.index).toBeGreaterThanOrEqual(0);
      expect(sprite.index).toBeLessThan(16);
      expect(sprite.column).toBe(sprite.index % 4);
      expect(sprite.row).toBe(Math.floor(sprite.index / 4));
    }
  });
});
