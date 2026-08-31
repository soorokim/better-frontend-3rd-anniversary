import { notFound } from 'next/navigation';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import { avatarCatalog } from '@/lib/avatar/catalog';

export const dynamic = 'force-dynamic';

export default function AvatarLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const examples = avatarCatalog.hair.flatMap((hair, hairIndex) =>
    avatarCatalog.outfit.map((outfit, outfitIndex) => ({
      body: avatarCatalog.body[(hairIndex + outfitIndex) % avatarCatalog.body.length],
      hair,
      outfit,
      accessory: avatarCatalog.accessory[(hairIndex + outfitIndex) % avatarCatalog.accessory.length],
      accent: avatarCatalog.accent[(hairIndex * 2 + outfitIndex) % avatarCatalog.accent.length],
    })),
  );

  return <main className="mx-auto min-h-screen max-w-5xl p-8 text-[#f4f0e8]">
    <h1 className="mb-2 text-3xl">PIXEL PARTS LAB</h1>
    <p className="mb-8 text-[#aaa6bd]">런타임 레이어 정렬을 확인하는 개발 전용 화면 · 1,200 combinations</p>
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 md:grid-cols-5">
      {examples.map((traits, index) => <article key={`${traits.hair}-${traits.outfit}`} className="text-center">
        <PixelAvatar nickname={`샘플 ${index + 1}`} traits={traits} size={128} />
        <p className="mt-2 text-xs text-[#aaa6bd]">{traits.hair} · {traits.outfit}<br />{traits.accessory} · {traits.accent}</p>
      </article>)}
    </div>
    <h2 className="mb-4 mt-10 text-xl">CONVERSATION ITEMS</h2>
    <div className="flex gap-5">
      {(['RUBBER DUCK', 'UNKNOWN USB'] as const).map((developerItem) => <article key={developerItem} className="text-center">
        <PixelAvatar
          nickname={developerItem}
          traits={{ body: 'warm', hair: 'short', outfit: 'hoodie', accessory: 'none', accent: 'yellow', developerItem }}
          size={128}
        />
        <p className="mt-2 text-xs text-[#aaa6bd]">{developerItem}</p>
      </article>)}
    </div>
  </main>;
}
