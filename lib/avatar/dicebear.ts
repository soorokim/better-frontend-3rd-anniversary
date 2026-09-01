import { Avatar, Style, type StyleOptions } from '@dicebear/core';
import openPeepsDefinition from '@dicebear/styles/open-peeps.json' with { type: 'json' };
import { type AvatarTraits } from './catalog';
import { normalizeAvatarTraits } from './presentation';
import { avatarRenderSeed } from './presentation';

const openPeepsStyle = new Style(openPeepsDefinition);

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

// Open Peeps' Bold Pop preset: saturated solid grounds; the seeded character
// components remain unconstrained so every participant stays distinct.
const boldPopBackgrounds = ['ff6b6b', 'feca57', '48dbfb', '1dd1a1', '5f27cd'];

export function renderPixelAvatar(input: Record<string, string>): string {
  const traits = normalizeAvatarTraits(input);
  const options: StyleOptions<typeof openPeepsDefinition> = {
    seed: avatarRenderSeed(input),
    skinColor: [skinColors[traits.body]],
    clothingColor: [accentColors[traits.accent]],
    backgroundColor: boldPopBackgrounds,
    backgroundColorFill: 'solid',
  };

  return new Avatar(openPeepsStyle, options).toString();
}
