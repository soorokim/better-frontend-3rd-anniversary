import { layeredAvatarParts, type LayeredAvatarParts } from '@/lib/avatar/presentation';

type Traits = Record<string, string>;
type Body = LayeredAvatarParts['body'];
type Hair = LayeredAvatarParts['hair'];
type Outfit = LayeredAvatarParts['outfit'];
type Accessory = LayeredAvatarParts['accessory'];
type Accent = LayeredAvatarParts['accent'];

const assetRoot = '/avatar-parts/v2';

const bodyAssets: Record<Body, string> = {
  light: `${assetRoot}/body-light.png`,
  warm: `${assetRoot}/body-warm.png`,
  deep: `${assetRoot}/body-deep.png`,
};

const hairAssets: Record<Hair, string> = {
  short: `${assetRoot}/hair-short.png`,
  wave: `${assetRoot}/hair-wave.png`,
  bob: `${assetRoot}/hair-bob.png`,
  spike: `${assetRoot}/hair-spike.png`,
  cap: `${assetRoot}/hair-cap.png`,
};

const outfitAssets: Record<Outfit, string> = {
  hoodie: `${assetRoot}/outfit-hoodie.png`,
  sweater: `${assetRoot}/outfit-sweater.png`,
  jacket: `${assetRoot}/outfit-jacket.png`,
  overalls: `${assetRoot}/outfit-overalls.png`,
};

const itemAssets: Record<Accessory, string | null> = {
  none: null,
  terminal: `${assetRoot}/item-laptop.png`,
  laptop: `${assetRoot}/item-laptop.png`,
  keyboard: `${assetRoot}/item-keyboard.png`,
  coffee: `${assetRoot}/item-coffee.png`,
  book: `${assetRoot}/item-error-log.png`,
  duck: `${assetRoot}/item-duck.png`,
  usb: `${assetRoot}/item-usb.png`,
  'error-log': `${assetRoot}/item-error-log.png`,
  'test-check': `${assetRoot}/item-test-check.png`,
  'browser-tabs': `${assetRoot}/item-browser-tabs.png`,
};

const accentColors: Record<Accent, { main: string; shadow: string }> = {
  yellow: { main: '#ffe657', shadow: '#d59c32' },
  pink: { main: '#f27cac', shadow: '#a8427a' },
  mint: { main: '#62d5aa', shadow: '#278b79' },
  sky: { main: '#62b8e9', shadow: '#316aa3' },
};

const faceColors: Record<Body, { shade: string; blush: string }> = {
  light: { shade: '#b96f62', blush: '#f09491' },
  warm: { shade: '#754132', blush: '#c96b66' },
  deep: { shade: '#321e25', blush: '#9b554d' },
};

function RasterLayer({ src, layer, part }: { src: string; layer: string; part: string }) {
  return <span
    aria-hidden="true"
    data-avatar-layer={layer}
    data-avatar-part={part}
    className="absolute inset-0 bg-contain bg-center bg-no-repeat [image-rendering:pixelated]"
    style={{ backgroundImage: `url("${src}")` }}
  />;
}

function Face({ body, accent }: { body: Body; accent: Accent }) {
  const face = faceColors[body];
  const color = accentColors[accent];
  return <svg
    aria-hidden="true"
    viewBox="0 0 256 384"
    className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
    shapeRendering="crispEdges"
    data-avatar-layer="face"
    data-avatar-part={accent}
  >
    <rect x="83" y="94" width="32" height="8" fill={face.shade} />
    <rect x="143" y="94" width="30" height="8" fill={face.shade} />
    <rect x="88" y="105" width="22" height="25" fill="#080d24" />
    <rect x="148" y="105" width="22" height="25" fill="#080d24" />
    <rect x="92" y="108" width="7" height="7" fill="#f4f0e8" />
    <rect x="152" y="108" width="7" height="7" fill="#f4f0e8" />
    <rect x="74" y="132" width="15" height="7" fill={face.blush} />
    <rect x="171" y="132" width="15" height="7" fill={face.blush} />
    <rect x="124" y="125" width="8" height="9" fill={face.shade} />
    <rect x="107" y="145" width="47" height="9" fill="#080d24" />
    <rect x="117" y="145" width="27" height="4" fill="#f4f0e8" />
    <rect x="64" y="70" width="8" height="15" fill={color.main} />
    <rect x="58" y="76" width="20" height="4" fill={color.main} />
    <rect x="184" y="82" width="7" height="14" fill={color.shadow} />
    <rect x="178" y="87" width="19" height="4" fill={color.shadow} />
  </svg>;
}

function Sparkles({ accent }: { accent: Accent }) {
  const color = accentColors[accent];
  return <svg
    aria-hidden="true"
    viewBox="0 0 256 384"
    className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
    shapeRendering="crispEdges"
    data-avatar-layer="accent"
    data-avatar-part={accent}
  >
    <rect x="20" y="103" width="8" height="24" fill={color.main} />
    <rect x="12" y="111" width="24" height="8" fill={color.main} />
    <rect x="226" y="139" width="7" height="21" fill={color.main} />
    <rect x="219" y="146" width="21" height="7" fill={color.main} />
    <rect x="26" y="315" width="7" height="17" fill={color.shadow} />
    <rect x="220" y="300" width="7" height="17" fill={color.shadow} />
  </svg>;
}

export function PixelAvatar({ traits, nickname, size = 192 }: { traits: Traits; nickname: string; size?: number }) {
  const parts = layeredAvatarParts(traits);
  const item = itemAssets[parts.accessory];
  const developerClass = traits.developerAdjective && traits.developerNoun
    ? `, ${traits.developerAdjective} ${traits.developerNoun}`
    : '';
  const itemDescription = traits.developerItem ? `, 장착 아이템 ${traits.developerItem}` : '';
  const description = `${nickname}의 픽셀 캐릭터, 전신 개발자 아바타${developerClass}${itemDescription}`;

  return <span
    role="img"
    aria-label={description}
    style={{ width: size, height: size }}
    className="relative mx-auto inline-block shrink-0 overflow-hidden border-4 border-[#11162b] bg-[radial-gradient(circle_at_50%_80%,#34466f_0_23%,transparent_24%),linear-gradient(#152042,#080d1d)] shadow-[4px_4px_0_#817a9c]"
    data-avatar-combination={`${parts.body}:${parts.hair}:${parts.outfit}:${parts.accessory}:${parts.accent}`}
  >
    <RasterLayer src={bodyAssets[parts.body]} layer="body" part={parts.body} />
    <Face body={parts.body} accent={parts.accent} />
    <RasterLayer src={hairAssets[parts.hair]} layer="hair" part={parts.hair} />
    <RasterLayer src={outfitAssets[parts.outfit]} layer="outfit" part={parts.outfit} />
    {item ? <RasterLayer src={item} layer="accessory" part={parts.accessory} /> : <span data-avatar-layer="accessory" data-avatar-part="none" />}
    <Sparkles accent={parts.accent} />
  </span>;
}
