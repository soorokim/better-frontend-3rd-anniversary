import type { CSSProperties } from 'react';
import Image from 'next/image';
import { pixelAvatarUrl } from '@/lib/avatar/presentation';

type Traits = Record<string, string>;
const accessoryLabels: Record<string, string> = {
  terminal: '>_',
  keyboard: '⌨',
  coffee: '☕',
  book: '▥',
};

const developerItemLabels: Record<string, string> = {
  'RUBBER DUCK': 'DUCK',
  COFFEE: '☕',
  'MECHANICAL KEYBOARD': '⌨',
  LAPTOP: '▰',
  'RED ERROR LOG': 'ERR',
  'GREEN TEST CHECK': '✓',
  'ENDLESS BROWSER TABS': '∞',
  'UNKNOWN USB': 'USB',
};

export function PixelAvatar({ traits, nickname, size = 128 }: { traits: Traits; nickname: string; size?: number }) {
  const style = { width: size, height: size } as CSSProperties;
  const developerClass = traits.developerAdjective && traits.developerNoun
    ? `, ${traits.developerAdjective} ${traits.developerNoun}`
    : '';
  const description = `${nickname}의 픽셀 캐릭터${developerClass}, ${traits.hair??'기본'} 머리와 ${traits.outfit??'기본'} 옷`;
  const accessory = developerItemLabels[traits.developerItem] ?? accessoryLabels[traits.accessory];

  return <span style={style} className="relative mx-auto inline-block shrink-0 overflow-hidden border-4 border-[#11162b] bg-[#090d19] shadow-[3px_3px_0_#817a9c] [image-rendering:pixelated]">
    <Image unoptimized src={pixelAvatarUrl(traits)} alt={description} width={size} height={size} className="block h-full w-full [image-rendering:pixelated]" />
    {accessory ? <span aria-hidden="true" className="absolute bottom-1 right-1 grid min-h-6 min-w-6 place-items-center border-2 border-[#11162b] bg-[var(--yellow)] px-1 font-mono text-xs font-black leading-none text-[#11162b]">{accessory}</span> : null}
  </span>;
}
