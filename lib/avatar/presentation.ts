import { avatarCatalog, type AvatarTrait, type AvatarTraits } from './catalog';
import { canonicalItemId, type CanonicalItemId } from './assets/manifest';

// Keep this seed namespace stable for the legacy `/avatars/pixel-art` API.
export const AVATAR_RENDERER_VERSION = 'dicebear-pixel-art-v1';

const fallbackTraits: AvatarTraits = {
  body: 'warm',
  hair: 'short',
  outfit: 'hoodie',
  accessory: 'none',
  accent: 'yellow',
};

const traitOrder = Object.keys(avatarCatalog) as AvatarTrait[];

export type LayeredAvatarParts = Omit<AvatarTraits, 'accessory'> & {
  accessory: CanonicalItemId;
};

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

export function layeredAvatarParts(input: Record<string, string>): LayeredAvatarParts {
  const traits = normalizeAvatarTraits(input);
  return {
    ...traits,
    accessory: canonicalItemId(traits.accessory, input.developerItem),
  };
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
