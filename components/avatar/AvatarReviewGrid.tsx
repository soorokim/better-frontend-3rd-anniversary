import { PixelAvatar } from '@/components/avatar/PixelAvatar';

const contextSizes = [192, 76, 52, 80, 48] as const;
const contextLabels: Record<(typeof contextSizes)[number], string> = {
  192: 'REVIEW',
  80: 'PRESENTER',
  76: 'ADMIN',
  52: 'LIST',
  48: 'MINIMUM',
};

const reviewCases = [
  { id: 'warm-short-hoodie', nickname: '민트 덕', traits: { body: 'warm', hair: 'short', outfit: 'hoodie', accessory: 'coffee', accent: 'mint' }, developerItem: 'RUBBER DUCK' },
  { id: 'light-wave-sweater', nickname: '핑크 커피', traits: { body: 'light', hair: 'wave', outfit: 'sweater', accessory: 'coffee', accent: 'pink' }, developerItem: 'COFFEE' },
  { id: 'deep-bob-jacket', nickname: '스카이 탭', traits: { body: 'deep', hair: 'bob', outfit: 'jacket', accessory: 'terminal', accent: 'sky' }, developerItem: 'ENDLESS BROWSER TABS' },
  { id: 'warm-spike-overalls', nickname: '옐로 테스트', traits: { body: 'warm', hair: 'spike', outfit: 'overalls', accessory: 'keyboard', accent: 'yellow' }, developerItem: 'GREEN TEST CHECK' },
] as const;

function CandidateAvatar({ reviewCase, size }: { reviewCase: (typeof reviewCases)[number]; size: number }) {
  return <span data-avatar-context-size={size}>
    <PixelAvatar nickname={reviewCase.nickname} traits={{ ...reviewCase.traits, developerItem: reviewCase.developerItem, developerHash: reviewCase.id }} size={size} />
  </span>;
}

export function AvatarReviewGrid({ mode = 'pilot' }: { mode?: 'pilot' }) {
  return <section data-testid="avatar-review-grid" data-review-mode={mode}>
    <div className="mb-6 border-2 border-[#817a9c] bg-[#111a3a] p-4 text-sm text-[#aaa6bd]">
      <p><span className="text-[#ffe657]">Open Peeps · Bold Pop</span> · 참가자별 seed와 32px 아이템 오버레이 검토</p>
      <p className="mt-2">대표 4개를 실제 사용 크기로 확인합니다. 아바타 본체는 DiceBear가 생성하고, 아이템만 프로젝트 SVG로 표시합니다.</p>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      {reviewCases.map((reviewCase) => <article key={reviewCase.id} data-pilot-case={reviewCase.id} className="min-w-0 border-4 border-[#817a9c] bg-[#202e58] p-4 shadow-[5px_5px_0_#0a1028]">
        <header className="mb-4 border-b-2 border-[#485987] pb-3">
          <p className="font-mono text-xs text-[#f27cac]">DICEBEAR / {reviewCase.id}</p>
          <h2 className="mt-1 break-words text-lg font-bold text-[#f4f0e8]">{reviewCase.traits.hair.toUpperCase()} · {reviewCase.traits.outfit.toUpperCase()} · {reviewCase.developerItem}</h2>
        </header>
        <div className="flex justify-center"><CandidateAvatar reviewCase={reviewCase} size={192} /></div>
        <div className="mt-5 flex items-end justify-center gap-2 overflow-hidden" aria-label="실제 사용 크기 비교">
          {contextSizes.slice(1).map((size) => <div key={size} className="min-w-0 text-center"><CandidateAvatar reviewCase={reviewCase} size={size} /><p className="mt-2 font-mono text-[8px] leading-none text-[#aaa6bd]">{contextLabels[size]}<br />{size}px</p></div>)}
        </div>
      </article>)}
    </div>
  </section>;
}
