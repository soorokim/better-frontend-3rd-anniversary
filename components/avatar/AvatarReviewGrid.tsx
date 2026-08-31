import {
  candidateAvatarManifest,
  resolveCandidateComposition,
  type AvatarAssetManifest,
} from '@/lib/avatar/assets/manifest';

const contextSizes = [192, 76, 52, 80, 48] as const;
const contextLabels: Record<(typeof contextSizes)[number], string> = {
  192: 'LOBBY',
  76: 'ADMIN',
  52: 'CONTROLLER',
  80: 'PRESENTER',
  48: 'MINIMUM',
};

const pilotVisualLabels: Record<string, string> = {
  'short-small-item': 'PARTED · T-SHIRT · DUCK',
  'long-wide-item': 'SIDE BOB · NAVY JACKET · TABS',
  'cap-tiny-item': 'HIGH PONYTAIL · FORMAL · USB',
  'tall-large-item': 'SPIKED · CARDIGAN · TEST',
};

function CandidateAvatar({
  pilot,
  size,
  manifest,
}: {
  pilot: AvatarAssetManifest['pilotCases'][number];
  size: number;
  manifest: AvatarAssetManifest;
}) {
  const composition = resolveCandidateComposition(pilot.traits, pilot.developerItem, manifest);
  const faceIndex = manifest.layerOrder.indexOf('faceFeatures');
  const beforeFace = composition.layers.filter(({ role }) => manifest.layerOrder.indexOf(role) < faceIndex);
  const afterFace = composition.layers.filter(({ role }) => manifest.layerOrder.indexOf(role) > faceIndex && role !== 'accent');
  const raster = (layer: (typeof composition.layers)[number]) => <span
    key={`${layer.role}-${layer.path}`}
    aria-hidden="true"
    className="absolute inset-0 bg-contain bg-center bg-no-repeat [image-rendering:pixelated]"
    style={{ backgroundImage: `url("${layer.path}")` }}
    data-avatar-layer={layer.role}
  />;

  return <span
    role="img"
    aria-label={`${pilot.id} 후보 픽셀 캐릭터`}
    style={{ width: size, height: size }}
    className="relative inline-block shrink-0 overflow-hidden border-2 border-[#817a9c] bg-[radial-gradient(circle_at_50%_78%,#34466f_0_22%,transparent_23%),linear-gradient(#172449,#090e22)] shadow-[3px_3px_0_#0a1028]"
    data-avatar-context-size={size}
    data-avatar-asset-set={manifest.assetSetVersion}
    data-avatar-phase={manifest.phase}
    data-avatar-combination={composition.combinationId}
  >
    {beforeFace.map(raster)}
    {afterFace.map(raster)}
  </span>;
}

export function AvatarReviewGrid({ mode = 'pilot' }: { mode?: 'pilot' }) {
  const manifest = candidateAvatarManifest;
  return <section data-testid="avatar-review-grid" data-review-mode={mode}>
    <div className="mb-6 border-2 border-[#817a9c] bg-[#111a3a] p-4 text-sm text-[#aaa6bd]">
      <p><span className="text-[#ffe657]">{manifest.assetSetVersion}</span> · {manifest.phase.toUpperCase()} · 승인 전 후보</p>
      <p className="mt-2">대표 4개를 실제 사용 크기로 확인합니다. 이 화면의 에셋은 참가자 화면에 아직 적용되지 않았습니다.</p>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      {manifest.pilotCases.map((pilot) => <article
        key={pilot.id}
        data-pilot-case={pilot.id}
        className="min-w-0 border-4 border-[#817a9c] bg-[#202e58] p-4 shadow-[5px_5px_0_#0a1028]"
      >
        <header className="mb-4 border-b-2 border-[#485987] pb-3">
          <p className="font-mono text-xs text-[#f27cac]">PILOT / {pilot.id}</p>
          <h2 className="mt-1 break-words text-lg font-bold text-[#f4f0e8]">
            {pilotVisualLabels[pilot.id] ?? `${pilot.traits.hair} · ${pilot.traits.outfit} · ${pilot.expectedItemId}`}
          </h2>
        </header>
        <div className="flex justify-center">
          <CandidateAvatar pilot={pilot} size={192} manifest={manifest} />
        </div>
        <div className="mt-5 flex items-end justify-center gap-2 overflow-hidden" aria-label="실제 사용 크기 비교">
          {contextSizes.slice(1).map((size) => <div key={size} className="min-w-0 text-center">
            <CandidateAvatar pilot={pilot} size={size} manifest={manifest} />
            <p className="mt-2 font-mono text-[8px] leading-none text-[#aaa6bd]">{contextLabels[size]}<br />{size}px</p>
          </div>)}
        </div>
        <p className="mt-4 break-words font-mono text-[10px] leading-4 text-[#aaa6bd]">
          {pilot.riskCoverage.join(' · ')}
        </p>
      </article>)}
    </div>
  </section>;
}
