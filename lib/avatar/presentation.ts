import { avatarCatalog, type AvatarTrait, type AvatarTraits } from './catalog';

export const AVATAR_RENDERER_VERSION = 'dicebear-pixel-art-v1';
export const FULL_BODY_AVATAR_ATLAS = '/avatar-parts/full-body-developers-v1.png';
export const FULL_BODY_AVATAR_COUNT = 16;

const fallbackTraits: AvatarTraits = {
  body: 'warm',
  hair: 'short',
  outfit: 'hoodie',
  accessory: 'none',
  accent: 'yellow',
};

const traitOrder = Object.keys(avatarCatalog) as AvatarTrait[];

const itemSpriteOptions: Record<string, readonly number[]> = {
  'RUBBER DUCK': [2],
  COFFEE: [1, 9],
  'MECHANICAL KEYBOARD': [4],
  LAPTOP: [0, 3, 10],
  'RED ERROR LOG': [6, 14],
  'GREEN TEST CHECK': [12, 13],
  'ENDLESS BROWSER TABS': [5, 6, 15],
  'UNKNOWN USB': [7],
};

function stableNumber(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function normalizeAvatarTraits(input: Record<string, string>): AvatarTraits {
  return Object.fromEntries(
    traitOrder.map((trait) => {
      const value = input[trait];
      const allowed = avatarCatalog[trait] as readonly string[];
      return [trait, allowed.includes(value) ? value : fallbackTraits[trait]];
    }),
  ) as AvatarTraits;
}

export function avatarRenderSeed(input: Record<string, string>): string {
  const traits = normalizeAvatarTraits(input);
  return [AVATAR_RENDERER_VERSION, ...traitOrder.map((trait) => `${trait}:${traits[trait]}`)].join('\0');
}

export function pixelAvatarUrl(input: Record<string, string>): string {
  const traits = normalizeAvatarTraits(input);
  const params = new URLSearchParams(traitOrder.map((trait) => [trait, traits[trait]]));
  return `/avatars/pixel-art?${params.toString()}`;
}

export function fullBodyAvatarSprite(input: Record<string, string>) {
  const seed = /^[0-9A-F]{4}-[0-9A-F]{4}$/i.test(input.developerHash ?? '')
    ? input.developerHash
    : avatarRenderSeed(input);
  const options = itemSpriteOptions[input.developerItem] ?? Array.from(
    { length: FULL_BODY_AVATAR_COUNT },
    (_, index) => index,
  );
  const index = options[stableNumber(seed) % options.length];
  return { index, column: index % 4, row: Math.floor(index / 4) };
}

export function fullBodyAvatarUrl(input: Record<string, string>): string {
  return `${FULL_BODY_AVATAR_ATLAS}?sprite=${fullBodyAvatarSprite(input).index}`;
}

export function traitsFromSearchParams(params: URLSearchParams): AvatarTraits {
  return normalizeAvatarTraits(Object.fromEntries(traitOrder.map((trait) => [trait, params.get(trait) ?? ''])));
}

export const revealMessages = [
  '대화의 온도를 측정하는 중~',
  '개발자 클래스를 조합하는 중~~',
  '장비 슬롯을 뒤지는 중~',
  '러버덕에게 최종 확인받는 중~~~',
  '픽셀을 한 칸씩 맞추는 중~',
] as const;

const temporaryClasses = [
  ['집요한', 'BUG HUNTER'],
  ['차분한', 'TYPE GUARDIAN'],
  ['야행성', 'RUNTIME RANGER'],
  ['호기심 많은', 'API ALCHEMIST'],
  ['끈질긴', 'MERGE RESOLVER'],
] as const;

const temporaryItems = ['RUBBER DUCK', 'COFFEE', 'MECHANICAL KEYBOARD', 'UNKNOWN USB'] as const;
const temporaryStatuses = ['RESOLVING TRAITS', 'CHECKING TYPES', 'RUNNING TESTS', 'EQUIPPING ITEM'] as const;

export function temporaryRevealTraits(index: number): Record<string, string> {
  const pair = temporaryClasses[index % temporaryClasses.length];
  const visual = Object.fromEntries(traitOrder.map((trait, traitIndex) => {
    const values = avatarCatalog[trait] as readonly string[];
    return [trait, values[(index + traitIndex) % values.length]];
  }));
  return {
    ...visual,
    developerAdjective: pair[0],
    developerNoun: pair[1],
    developerItem: temporaryItems[index % temporaryItems.length],
    developerStatus: temporaryStatuses[index % temporaryStatuses.length],
    developerHash: '????-????',
  };
}

export function approvedStatuses(traits: Record<string, string>): string[] {
  const values = (traits.developerStatuses ?? traits.developerStatus ?? '').split('\n').filter(Boolean);
  return [...new Set(values)];
}

export function nextApprovedStatus(statuses: string[], currentIndex: number): string | undefined {
  if (!statuses.length) return undefined;
  return statuses[(currentIndex + 1) % statuses.length];
}
