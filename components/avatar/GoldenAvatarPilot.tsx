const assetRoot = '/avatar-parts/v4-golden';
const goldenReference = `${assetRoot}/assembled-reference.png`;

const layers = [
  ['hairBack', 'hair-back.png'],
  ['bodyFace', 'body-face-warm.png'],
  ['outfitBase', 'outfit-base-navy-mint.png'],
  ['outfitNeckline', 'outfit-neckline-navy-mint.png'],
  ['hairFront', 'hair-front-indigo.png'],
] as const;

function AvatarImage({
  src,
  label,
  size,
}: {
  src: string;
  label: string;
  size: number;
}) {
  return <span
    role="img"
    aria-label={label}
    style={{ width: size, height: size }}
    className="relative inline-block shrink-0 overflow-hidden border-2 border-[#817a9c] bg-[radial-gradient(circle_at_50%_79%,#34466f_0_22%,transparent_23%),linear-gradient(#172449,#090e22)] shadow-[3px_3px_0_#0a1028]"
  >
    <span
      aria-hidden="true"
      className="absolute inset-0 bg-contain bg-center bg-no-repeat [image-rendering:pixelated]"
      style={{ backgroundImage: `url("${src}")` }}
    />
  </span>;
}

function ComposedAvatar({ size }: { size: number }) {
  return <span
    role="img"
    aria-label="공통 기준선으로 조립한 골든 아바타 후보"
    style={{ width: size, height: size }}
    className="relative inline-block shrink-0 overflow-hidden border-2 border-[#ffe657] bg-[radial-gradient(circle_at_50%_79%,#34466f_0_22%,transparent_23%),linear-gradient(#172449,#090e22)] shadow-[3px_3px_0_#0a1028]"
    data-avatar-asset-set="golden-master-v4"
  >
    <span
      aria-hidden="true"
      data-avatar-layer="golden-reference"
      className="absolute inset-0 bg-contain bg-center bg-no-repeat [image-rendering:pixelated]"
      style={{ backgroundImage: `url("${goldenReference}")` }}
    />
  </span>;
}

export function GoldenAvatarPilot() {
  return <section data-testid="golden-avatar-pilot">
    <div className="mb-5 border-2 border-[#ffe657] bg-[#111a3a] p-4 text-sm text-[#aaa6bd]">
      <p><span className="text-[#ffe657]">GOLDEN MASTER V4</span> · 원본 완성 조합을 기준으로 검증 중</p>
      <p className="mt-2">원본 조합의 목선·후드·이너 티셔츠 연결을 기준으로 삼습니다. 파츠 추출본은 이 모습과 같아질 때까지 운영 화면에 적용하지 않습니다.</p>
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <article className="min-w-0 border-4 border-[#817a9c] bg-[#202e58] p-3 text-center sm:p-5">
        <h3 className="mb-4 text-sm text-[#f27cac]">LAYER COMPOSITION</h3>
        <ComposedAvatar size={256} />
        <div className="mt-5 flex flex-wrap items-end justify-center gap-3">
          {[192, 80, 52, 48].map((size) => <div key={size} className="text-center">
            <ComposedAvatar size={size} />
            <p className="mt-1 font-mono text-[9px] text-[#aaa6bd]">{size}px</p>
          </div>)}
        </div>
      </article>
      <article className="min-w-0 border-4 border-[#817a9c] bg-[#202e58] p-3 sm:p-5">
        <h3 className="mb-4 text-center text-sm text-[#f27cac]">FULL-CANVAS LAYERS</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {layers.map(([role, filename]) => <div key={role} className="text-center">
            <AvatarImage src={`${assetRoot}/${filename}`} label={`${role} 단독 레이어`} size={128} />
            <p className="mt-2 break-words font-mono text-[10px] text-[#aaa6bd]">{role}</p>
          </div>)}
        </div>
        <p className="mt-6 text-xs leading-5 text-[#aaa6bd]">각 PNG는 보이는 영역만 잘라낸 파일이 아니라 동일한 256×384 캔버스입니다. 투명 여백이 정렬 정보로 남습니다.</p>
      </article>
    </div>
  </section>;
}
