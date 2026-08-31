import { describe, expect, it } from 'vitest';
import {
  assertApprovedManifest,
  avatarAssetManifestSchema,
  candidateAvatarManifest,
  canonicalItemId,
  canonicalItemIds,
  enumerateCanonicalRenderKeys,
  parseAvatarAssetManifest,
} from '@/lib/avatar/assets/manifest';
import { avatarCatalog } from '@/lib/avatar/catalog';
import { validateManifestStructure } from '@/scripts/validate-avatar-assets';

describe('avatar asset manifest', () => {
  it('strictly parses the pilot manifest contract', () => {
    expect(parseAvatarAssetManifest(candidateAvatarManifest)).toEqual(candidateAvatarManifest);
    expect(avatarAssetManifestSchema.safeParse({ ...candidateAvatarManifest, unexpected: true }).success).toBe(false);
  });

  it('covers every stable accessory and conversation item alias', () => {
    expect(Object.keys(candidateAvatarManifest.aliases.accessory)).toEqual(avatarCatalog.accessory);
    expect(Object.keys(candidateAvatarManifest.aliases.developerItem)).toEqual([
      'RUBBER DUCK', 'COFFEE', 'MECHANICAL KEYBOARD', 'LAPTOP', 'RED ERROR LOG',
      'GREEN TEST CHECK', 'ENDLESS BROWSER TABS', 'UNKNOWN USB',
    ]);
    expect(new Set([
      ...Object.values(candidateAvatarManifest.aliases.accessory),
      ...Object.values(candidateAvatarManifest.aliases.developerItem),
    ])).toEqual(new Set(canonicalItemIds));
    expect(canonicalItemId('terminal')).toBe('laptop');
    expect(canonicalItemId('book')).toBe('error-log');
    expect(canonicalItemId('coffee', 'UNKNOWN USB')).toBe('usb');
  });

  it('refuses to activate a pilot or unreviewed manifest', () => {
    expect(() => assertApprovedManifest(candidateAvatarManifest)).toThrow(/not approved/);
    const approvedWithoutReview = {
      ...candidateAvatarManifest,
      phase: 'approved' as const,
    };
    expect(() => assertApprovedManifest(approvedWithoutReview)).toThrow(/not approved/);
  });

  it('enumerates exactly 2,160 deterministic canonical render keys', () => {
    const keys = enumerateCanonicalRenderKeys();
    expect(keys).toHaveLength(2160);
    expect(new Set(keys)).toHaveLength(2160);
    expect(keys[0]).toBe('light:short:hoodie:none:yellow');
    expect(keys.at(-1)).toBe('deep:cap:overalls:usb:sky');
    expect(validateManifestStructure(candidateAvatarManifest)).toEqual([]);
  });
});
