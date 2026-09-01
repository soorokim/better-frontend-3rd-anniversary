import Image from 'next/image';
import { layeredAvatarParts, pixelAvatarUrl } from '@/lib/avatar/presentation';
import type { CanonicalItemId } from '@/lib/avatar/assets/manifest';

type Traits = Record<string, string>;

const itemAssets: Record<Exclude<CanonicalItemId, 'none'>, string> = {
  duck: '/avatar-items/bold-pop/duck.svg',
  coffee: '/avatar-items/bold-pop/coffee.svg',
  keyboard: '/avatar-items/bold-pop/keyboard.svg',
  laptop: '/avatar-items/bold-pop/laptop.svg',
  'error-log': '/avatar-items/bold-pop/error-log.svg',
  'test-check': '/avatar-items/bold-pop/test-check.svg',
  'browser-tabs': '/avatar-items/bold-pop/browser-tabs.svg',
  usb: '/avatar-items/bold-pop/usb.svg',
};

export function PixelAvatar({ traits, nickname, size = 192 }: { traits: Traits; nickname: string; size?: number }) {
  const parts = layeredAvatarParts(traits);
  const itemSrc = parts.accessory === 'none' ? null : itemAssets[parts.accessory];
  const developerClass = traits.developerAdjective && traits.developerNoun
    ? `, ${traits.developerAdjective} ${traits.developerNoun}`
    : '';
  const itemDescription = traits.developerItem ? `, 장착 아이템 ${traits.developerItem}` : '';
  const description = `${nickname}의 픽셀 캐릭터, 전신 개발자 아바타${developerClass}${itemDescription}`;

  return <span
    role="img"
    aria-label={description}
    style={{ width: size, height: size }}
    className="relative mx-auto inline-block shrink-0 overflow-hidden border-4 border-[#11162b] bg-[#090d19] shadow-[4px_4px_0_#817a9c]"
    data-avatar-engine="dicebear-open-peeps-bold-pop-v1"
    data-avatar-combination={`${parts.body}:${parts.hair}:${parts.outfit}:${parts.accessory}:${parts.accent}`}
  >
    <Image
      aria-hidden="true"
      alt=""
      data-avatar-layer="dicebear"
      src={pixelAvatarUrl(traits)}
      fill
      unoptimized
      sizes={`${size}px`}
      className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
    />
    {itemSrc ? <span aria-hidden="true" data-avatar-layer="item" data-avatar-part={parts.accessory} className="absolute bottom-[4%] right-[3%] h-[30%] w-[30%]">
      <Image alt="" src={itemSrc} fill unoptimized sizes={`${Math.max(16, Math.round(size * 0.3))}px`} className="object-contain" />
    </span> : null}
  </span>;
}
