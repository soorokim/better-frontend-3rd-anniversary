import { Avatar, Style, type StyleOptions } from '@dicebear/core';
import pixelArtDefinition from '@dicebear/styles/pixel-art.json' with { type: 'json' };
import type { AvatarTraits } from './catalog';
import { avatarRenderSeed } from './presentation';

const pixelArtStyle = new Style(pixelArtDefinition);

const skinColors: Record<AvatarTraits['body'], string> = {
  light: 'ffdbac',
  warm: 'cb9e6e',
  deep: '8d5524',
};

const accentColors: Record<AvatarTraits['accent'], string> = {
  yellow: 'ffe95c',
  pink: 'e779a9',
  mint: '65d4a0',
  sky: '62b7e8',
};

const hairVariants = {
  short: ['short01', 'short02', 'short03', 'short04'],
  wave: ['long04', 'long06', 'long11', 'long16'],
  bob: ['long02', 'long03', 'long09', 'long13'],
  spike: ['short05', 'short08', 'short10', 'short13'],
  cap: ['short01', 'short03', 'short09'],
} as const satisfies Record<AvatarTraits['hair'], readonly string[]>;

const clothesVariants = {
  hoodie: ['variant02', 'variant05', 'variant11'],
  sweater: ['variant03', 'variant06', 'variant13'],
  jacket: ['variant10', 'variant17', 'variant19'],
  overalls: ['variant12', 'variant22', 'variant23'],
} as const satisfies Record<AvatarTraits['outfit'], readonly string[]>;

const hatVariants = ['variant03', 'variant08', 'variant10'] as const;

export function renderPixelAvatar(traits: AvatarTraits): string {
  const options: StyleOptions<typeof pixelArtDefinition> = {
    seed: avatarRenderSeed(traits),
    skinColor: [skinColors[traits.body]],
    clothingColor: [accentColors[traits.accent]],
    hairVariant: hairVariants[traits.hair],
    clothesVariant: clothesVariants[traits.outfit],
    hairProbability: 100,
    clothesProbability: 100,
    hatProbability: traits.hair === 'cap' ? 100 : 0,
    hatVariant: hatVariants,
    accessoriesProbability: 0,
    backgroundColor: ['090d19'],
  };

  return new Avatar(pixelArtStyle, options).toString();
}
