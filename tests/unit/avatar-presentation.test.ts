import { describe, expect, it } from 'vitest';
import { renderPixelAvatar } from '@/lib/avatar/dicebear';
import {
  layeredAvatarParts,
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

  it('renders the same Open Peeps Bold Pop SVG for the same traits', () => {
    const normalized = normalizeAvatarTraits(traits);
    const first = renderPixelAvatar(normalized);
    const second = renderPixelAvatar(normalized);

    expect(second).toBe(first);
    expect(first).toContain('<svg');
    expect(first).toContain('<dc:title>Open Peeps</dc:title>');
    expect(first).toContain('viewBox="0 0 704 704"');
    expect(first).toMatch(/fill="#(ff6b6b|feca57|48dbfb|1dd1a1|5f27cd)"/);
  });

  it('passes the generated participant hash through to the DiceBear seed', () => {
    const first = renderPixelAvatar({ ...traits, developerHash: 'A1B2-C3D4' });
    const second = renderPixelAvatar({ ...traits, developerHash: 'D4C3-B2A1' });

    expect(first).not.toBe(second);
    expect(pixelAvatarUrl({ ...traits, developerHash: 'A1B2-C3D4' })).toContain('developerHash=A1B2-C3D4');
  });

  it('keeps the generated trait combination instead of collapsing it into an atlas cell', () => {
    expect(layeredAvatarParts(traits)).toEqual({ ...traits, accessory: 'laptop' });
  });

  it('lets a conversation-derived item choose the visible handheld layer', () => {
    expect(layeredAvatarParts({ ...traits, developerItem: 'COFFEE' }).accessory).toBe('coffee');
    expect(layeredAvatarParts({ ...traits, developerItem: 'MECHANICAL KEYBOARD' }).accessory).toBe('keyboard');
    expect(layeredAvatarParts({ ...traits, developerItem: 'LAPTOP' }).accessory).toBe('laptop');
    expect(layeredAvatarParts({ ...traits, developerItem: 'RED ERROR LOG' }).accessory).toBe('error-log');
    expect(layeredAvatarParts({ ...traits, developerItem: 'GREEN TEST CHECK' }).accessory).toBe('test-check');
    expect(layeredAvatarParts({ ...traits, developerItem: 'ENDLESS BROWSER TABS' }).accessory).toBe('browser-tabs');
    expect(layeredAvatarParts({ ...traits, developerItem: 'RUBBER DUCK' }).accessory).toBe('duck');
    expect(layeredAvatarParts({ ...traits, developerItem: 'UNKNOWN USB' }).accessory).toBe('usb');
  });
});
