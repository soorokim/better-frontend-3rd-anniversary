import type { CSSProperties } from 'react';
import Image from 'next/image';
import {
  fullBodyAvatarSprite,
  fullBodyAvatarUrl,
} from '@/lib/avatar/presentation';

type Traits = Record<string, string>;

export function PixelAvatar({ traits, nickname, size = 128 }: { traits: Traits; nickname: string; size?: number }) {
  const style = { width: size, height: size } as CSSProperties;
  const sprite = fullBodyAvatarSprite(traits);
  const spriteStyle = {
    width: size * 4,
    height: size * 4,
    maxWidth: 'none',
    left: -sprite.column * size,
    top: -sprite.row * size,
  } as CSSProperties;
  const developerClass = traits.developerAdjective && traits.developerNoun
    ? `, ${traits.developerAdjective} ${traits.developerNoun}`
    : '';
  const description = `${nickname}의 픽셀 캐릭터, 전신 개발자 아바타${developerClass}`;

  return <span style={style} className="relative mx-auto inline-block shrink-0 overflow-hidden border-4 border-[#11162b] bg-[radial-gradient(circle_at_50%_80%,#27365f_0_18%,transparent_19%),linear-gradient(#111a35,#090d19)] shadow-[3px_3px_0_#817a9c] [image-rendering:pixelated]">
    <Image
      unoptimized
      src={fullBodyAvatarUrl(traits)}
      alt={description}
      width={size * 4}
      height={size * 4}
      style={spriteStyle}
      className="absolute block [image-rendering:pixelated]"
    />
  </span>;
}
