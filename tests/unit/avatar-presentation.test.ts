import { describe, expect, it } from 'vitest';
import { renderPixelAvatar } from '@/lib/avatar/dicebear';
import { normalizeAvatarTraits, pixelAvatarUrl } from '@/lib/avatar/presentation';

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
});
