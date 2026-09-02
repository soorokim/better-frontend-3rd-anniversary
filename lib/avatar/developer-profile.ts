import { createHash } from 'node:crypto';
import type { ConversationProfileData } from '@/db/schema';
import { generateAvatarFromDigest } from './generator';

export const DEVELOPER_PROFILE_VERSION = 'developer-profile-v4';
export const DEVELOPER_CATALOG_VERSION = 'developer-catalog-v1';

export const developerItems = [
  'RUBBER DUCK',
  'COFFEE',
  'MECHANICAL KEYBOARD',
  'LAPTOP',
  'RED ERROR LOG',
  'GREEN TEST CHECK',
  'ENDLESS BROWSER TABS',
  'UNKNOWN USB',
] as const;

export const developerStatuses = [
  'BUILD PASSING',
  'TESTS PASSED',
  'WORKS ON MY MACHINE',
  'REVIEW REQUESTED',
  'DEPLOYING SOON',
  'NODE_MODULES TOO HEAVY',
  'MERGE CONFLICT RESOLVED',
  'LGTM',
] as const;

export type DeveloperProfile = {
  selectedAdjective: string | null;
  selectedNoun: string | null;
  className: string | null;
  item: string;
  itemReason: string;
  defaultStatus: string;
  easterEggStatuses: string[];
  displayHash: string;
  generatorVersion: string;
  avatarSeed?: string;
  avatarOptions?: Record<string, string>;
};

type ProfileInput = {
  sourceVersion: string;
  sourceDigest: string;
  adjectiveCandidates: string[];
  nounCandidates: string[];
  signals: Record<string, number>;
  topicRates?: Record<string, number>;
};

const topicItem: Record<string, { item: typeof developerItems[number]; reason: string }> = {
  frontend: { item: 'ENDLESS BROWSER TABS', reason: '프론트엔드와 브라우저 관련 주제가 특히 자주 보여서 골랐어요.' },
  backend: { item: 'LAPTOP', reason: 'API·서버·데이터를 연결하는 대화가 두드러져서 골랐어요.' },
  infra: { item: 'UNKNOWN USB', reason: '배포와 실행 환경을 챙기는 대화가 두드러져서 골랐어요.' },
  quality: { item: 'GREEN TEST CHECK', reason: '테스트와 문제 해결을 꼼꼼히 챙기는 대화가 두드러져서 골랐어요.' },
  design: { item: 'LAPTOP', reason: '화면과 사용 경험을 함께 다듬는 대화가 두드러져서 골랐어요.' },
  tools: { item: 'MECHANICAL KEYBOARD', reason: '도구와 작업 흐름을 가꾸는 대화가 두드러져서 골랐어요.' },
};

function semanticItem(input: ProfileInput) {
  const topics = Object.entries(input.topicRates ?? {}).filter(([, rate]) => rate > 0).sort(([, a], [, b]) => b - a);
  const [top, runnerUp] = topics;
  if (top && top[1] >= 2 && (!runnerUp || top[1] >= runnerUp[1] * 1.4) && topicItem[top[0]]) return topicItem[top[0]];

  const signal = (name: string) => input.signals[name] ?? 0;
  if (topics.length >= 3) return { item: 'LAPTOP' as const, reason: '여러 관심사를 두루 오가며 대화를 풍성하게 만든 모습이 보여서 골랐어요.' };
  if (signal('links') >= .7 || signal('attachments') >= .7) return { item: 'ENDLESS BROWSER TABS' as const, reason: '발견한 자료와 이야깃거리를 자주 나누는 모습이 보여서 골랐어요.' };
  if (signal('cheer') >= .7) return { item: 'COFFEE' as const, reason: '편안한 반응과 웃음으로 대화에 온기를 더하는 모습이 보여서 골랐어요.' };
  if (signal('curiosity') >= .7) return { item: 'RUBBER DUCK' as const, reason: '궁금한 것을 함께 풀어 가는 질문이 돋보여서 골랐어요.' };
  if (signal('consistency') >= .7) return { item: 'MECHANICAL KEYBOARD' as const, reason: '꾸준히 대화에 함께하며 흐름을 이어 가는 모습이 보여서 골랐어요.' };
  if (signal('story') >= .7) return { item: 'LAPTOP' as const, reason: '생각과 이야기를 차분히 나누는 모습이 보여서 골랐어요.' };
  return { item: 'COFFEE' as const, reason: '단톡방에 편안하게 함께해 준 감초 같은 존재감을 담아 골랐어요.' };
}

function hash(namespace: string, digest: string): Buffer {
  return createHash('sha256')
    .update(`${DEVELOPER_PROFILE_VERSION}\0${DEVELOPER_CATALOG_VERSION}\0${namespace}\0${digest}`, 'utf8')
    .digest();
}

function indexFor(namespace: string, digest: string, length: number): number {
  return hash(namespace, digest).readUInt32BE(0) % length;
}

function uniqueCandidates(values: string[], max: number): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, max);
}

function rotated<T>(values: readonly T[], offset: number): T[] {
  if (!values.length) return [];
  const start = offset % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

function profileCandidates(input: ProfileInput): DeveloperProfile[] {
  const adjectives = uniqueCandidates(input.adjectiveCandidates, 3);
  const nouns = uniqueCandidates(input.nounCandidates, 6);
  const adjectiveOrder = rotated(adjectives, adjectives.length ? indexFor('adjective', input.sourceDigest, adjectives.length) : 0);
  const nounOrder = rotated(nouns, nouns.length ? indexFor('noun', input.sourceDigest, nouns.length) : 0);
  const semantic = semanticItem(input);
  const itemOrder = [semantic.item, ...rotated(developerItems.filter((item) => item !== semantic.item), indexFor('item', input.sourceDigest, developerItems.length - 1))];
  const classPairs = adjectiveOrder.length && nounOrder.length
    ? adjectiveOrder.flatMap((adjective) => nounOrder.map((noun) => ({ adjective, noun })))
    : [{ adjective: null, noun: null }];
  const shortHash = hash('profile-hash', input.sourceDigest).toString('hex').slice(0, 8).toUpperCase();
  const defaultStatus = developerStatuses[indexFor('status', input.sourceDigest, developerStatuses.length)];
  const easterEggStatuses = rotated(
    developerStatuses.filter((status) => status !== defaultStatus),
    indexFor('easter-egg-status', input.sourceDigest, developerStatuses.length - 1),
  ).slice(0, 4);

  return classPairs.flatMap(({ adjective, noun }) => itemOrder.map((item) => ({
    selectedAdjective: adjective,
    selectedNoun: noun,
    className: adjective && noun ? `${adjective} ${noun}` : null,
    item,
    itemReason: item === semantic.item ? semantic.reason : '대화에서 보인 여러 특징과 팀 안의 조합을 함께 고려해 골랐어요.',
    defaultStatus,
    easterEggStatuses,
    displayHash: `${shortHash.slice(0, 4)}-${shortHash.slice(4)}`,
    generatorVersion: DEVELOPER_PROFILE_VERSION,
  })));
}

export function generateDeveloperProfile(
  sourceDigest: string,
  adjectiveCandidates: string[],
  nounCandidates: string[],
  signals: Record<string, number> = {},
  topicRates: Record<string, number> = {},
): DeveloperProfile {
  return profileCandidates({
    sourceVersion: 'conversation',
    sourceDigest,
    adjectiveCandidates,
    nounCandidates,
    signals,
    topicRates,
  })[0];
}

/**
 * Retains a participant's established identity while allowing only the item
 * semantics to evolve with a newer profile version.
 */
export function allocateDeveloperProfiles(
  inputs: ProfileInput[],
  previous: ReadonlyMap<string, DeveloperProfile> = new Map(),
): Map<string, ConversationProfileData> {
  const result = new Map<string, ConversationProfileData>();
  const used = new Set<string>();

  for (const input of [...inputs].sort((a, b) => a.sourceDigest.localeCompare(b.sourceDigest))) {
    const prior = previous.get(input.sourceDigest);
    const candidates = profileCandidates(input);
    const semantic = semanticItem(input);
    const selected = prior ? {
      ...prior,
      item: semantic.item,
      itemReason: semantic.reason,
      generatorVersion: DEVELOPER_PROFILE_VERSION,
    } : candidates.find((candidate) => !used.has(`${candidate.className ?? '—'}\0${candidate.item}`)) ?? candidates[0];
    used.add(`${selected.className ?? '—'}\0${selected.item}`);
    const visual = prior?.avatarOptions ? { traits: prior.avatarOptions } : generateAvatarFromDigest(input.sourceVersion, input.sourceDigest);
    result.set(input.sourceDigest, {
      adjectiveCandidates: uniqueCandidates(input.adjectiveCandidates, 3),
      nounCandidates: uniqueCandidates(input.nounCandidates, 6),
    signals: input.signals,
      ...selected,
      avatarSeed: input.sourceDigest,
      avatarOptions: visual.traits,
    });
  }
  return result;
}

export function developerTraits(profile: ConversationProfileData): Record<string, string> {
  return {
    ...profile.avatarOptions,
    ...(profile.selectedAdjective ? { developerAdjective: profile.selectedAdjective } : {}),
    ...(profile.selectedNoun ? { developerNoun: profile.selectedNoun } : {}),
    developerItem: profile.item,
    developerItemReason: profile.itemReason,
    developerStatus: profile.defaultStatus,
    developerStatuses: [profile.defaultStatus, ...profile.easterEggStatuses].join('\n'),
    developerHash: profile.displayHash,
    developerProfileVersion: profile.generatorVersion,
  };
}

export function hasDeveloperProfile(traits: Record<string, string>) {
  return Boolean(traits.developerItem && traits.developerStatus && traits.developerHash);
}
