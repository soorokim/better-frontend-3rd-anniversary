import type { ReactNode } from 'react';
import { layeredAvatarParts } from '@/lib/avatar/presentation';

type Traits = Record<string, string>;

const palette = {
  outline: '#080d24',
  shadow: '#111a35',
  trouser: '#1b2b50',
  shoe: '#090d19',
  white: '#f4f0e8',
  light: { skin: '#ffd0ad', shade: '#e89b7f' },
  warm: { skin: '#c97d56', shade: '#8e4d3b' },
  deep: { skin: '#794536', shade: '#4f2b2a' },
  yellow: { main: '#ffe657', shade: '#d59c32' },
  pink: { main: '#f27cac', shade: '#a8427a' },
  mint: { main: '#62d5aa', shade: '#278b79' },
  sky: { main: '#62b8e9', shade: '#316aa3' },
} as const;

function Pixel({ x, y, width = 1, height = 1, fill }: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill: string;
}) {
  return <rect x={x} y={y} width={width} height={height} fill={fill} />;
}

function Body({ tone }: { tone: keyof Pick<typeof palette, 'light' | 'warm' | 'deep'> }) {
  const skin = palette[tone];
  return <g data-avatar-layer="body">
    <Pixel x={10} y={3} width={12} height={11} fill={palette.outline} />
    <Pixel x={8} y={7} width={3} height={5} fill={palette.outline} />
    <Pixel x={21} y={7} width={3} height={5} fill={palette.outline} />
    <Pixel x={11} y={4} width={10} height={9} fill={skin.skin} />
    <Pixel x={9} y={8} width={2} height={3} fill={skin.skin} />
    <Pixel x={21} y={8} width={2} height={3} fill={skin.skin} />
    <Pixel x={19} y={5} width={2} height={7} fill={skin.shade} />
    <Pixel x={13} y={8} width={2} height={2} fill={palette.outline} />
    <Pixel x={18} y={8} width={2} height={2} fill={palette.outline} />
    <Pixel x={15} y={11} width={3} fill={skin.shade} />
    <Pixel x={14} y={14} width={4} height={3} fill={skin.skin} />
    <Pixel x={8} y={17} width={16} height={13} fill={palette.outline} />
    <Pixel x={5} y={18} width={4} height={10} fill={palette.outline} />
    <Pixel x={23} y={18} width={4} height={10} fill={palette.outline} />
    <Pixel x={6} y={19} width={3} height={8} fill={skin.skin} />
    <Pixel x={23} y={19} width={3} height={8} fill={skin.skin} />
    <Pixel x={6} y={26} width={4} height={3} fill={skin.skin} />
    <Pixel x={22} y={26} width={4} height={3} fill={skin.skin} />
    <Pixel x={10} y={29} width={5} height={7} fill={palette.outline} />
    <Pixel x={17} y={29} width={5} height={7} fill={palette.outline} />
    <Pixel x={11} y={29} width={4} height={6} fill={skin.skin} />
    <Pixel x={17} y={29} width={4} height={6} fill={skin.skin} />
  </g>;
}

function Hair({ kind }: { kind: 'short' | 'wave' | 'bob' | 'spike' | 'cap' }) {
  const hair = '#332841';
  const shine = '#61506f';
  const variants: Record<typeof kind, ReactNode> = {
    short: <>
      <Pixel x={9} y={2} width={14} height={4} fill={palette.outline} />
      <Pixel x={10} y={3} width={12} height={3} fill={hair} />
      <Pixel x={10} y={5} width={3} height={3} fill={hair} />
      <Pixel x={17} y={3} width={4} fill={shine} />
    </>,
    wave: <>
      <Pixel x={8} y={2} width={16} height={4} fill={palette.outline} />
      <Pixel x={8} y={5} width={4} height={9} fill={palette.outline} />
      <Pixel x={21} y={5} width={3} height={9} fill={palette.outline} />
      <Pixel x={9} y={3} width={14} height={3} fill={hair} />
      <Pixel x={9} y={5} width={3} height={8} fill={hair} />
      <Pixel x={21} y={5} width={2} height={8} fill={hair} />
      <Pixel x={11} y={3} width={4} height={2} fill={shine} />
    </>,
    bob: <>
      <Pixel x={8} y={2} width={16} height={5} fill={palette.outline} />
      <Pixel x={8} y={6} width={4} height={11} fill={palette.outline} />
      <Pixel x={21} y={6} width={3} height={11} fill={palette.outline} />
      <Pixel x={9} y={3} width={14} height={4} fill={hair} />
      <Pixel x={9} y={6} width={3} height={10} fill={hair} />
      <Pixel x={21} y={6} width={2} height={10} fill={hair} />
      <Pixel x={17} y={3} width={4} height={2} fill={shine} />
    </>,
    spike: <>
      <Pixel x={9} y={2} width={14} height={5} fill={palette.outline} />
      <Pixel x={10} y={1} width={3} height={3} fill={palette.outline} />
      <Pixel x={15} y={0} width={3} height={4} fill={palette.outline} />
      <Pixel x={20} y={1} width={3} height={3} fill={palette.outline} />
      <Pixel x={10} y={3} width={12} height={4} fill={hair} />
      <Pixel x={11} y={2} width={2} height={2} fill={hair} />
      <Pixel x={16} y={1} width={2} height={3} fill={hair} />
      <Pixel x={20} y={2} width={2} height={2} fill={shine} />
    </>,
    cap: <>
      <Pixel x={9} y={2} width={15} height={5} fill={palette.outline} />
      <Pixel x={8} y={6} width={9} height={2} fill={palette.outline} />
      <Pixel x={10} y={3} width={13} height={3} fill={hair} />
      <Pixel x={9} y={6} width={8} fill={shine} />
      <Pixel x={20} y={3} width={2} height={2} fill={shine} />
    </>,
  };
  return <g data-avatar-layer="hair" data-avatar-part={kind}>{variants[kind]}</g>;
}

function Outfit({ kind, accent }: {
  kind: 'hoodie' | 'sweater' | 'jacket' | 'overalls';
  accent: keyof Pick<typeof palette, 'yellow' | 'pink' | 'mint' | 'sky'>;
}) {
  const color = palette[accent];
  const common = <>
    <Pixel x={9} y={16} width={14} height={13} fill={palette.outline} />
    <Pixel x={10} y={17} width={12} height={11} fill={color.main} />
    <Pixel x={6} y={18} width={4} height={8} fill={palette.outline} />
    <Pixel x={22} y={18} width={4} height={8} fill={palette.outline} />
    <Pixel x={7} y={19} width={3} height={7} fill={color.main} />
    <Pixel x={22} y={19} width={3} height={7} fill={color.main} />
    <Pixel x={10} y={27} width={12} height={9} fill={palette.trouser} />
    <Pixel x={10} y={34} width={5} height={3} fill={palette.shoe} />
    <Pixel x={17} y={34} width={5} height={3} fill={palette.shoe} />
  </>;
  const details: Record<typeof kind, ReactNode> = {
    hoodie: <>
      <Pixel x={12} y={15} width={8} height={3} fill={color.shade} />
      <Pixel x={15} y={18} width={2} height={5} fill={palette.white} />
      <Pixel x={13} y={24} width={6} height={2} fill={color.shade} />
    </>,
    sweater: <>
      <Pixel x={10} y={20} width={12} height={2} fill={color.shade} />
      <Pixel x={10} y={24} width={12} height={2} fill={color.shade} />
      <Pixel x={12} y={17} width={8} height={2} fill={palette.white} />
    </>,
    jacket: <>
      <Pixel x={15} y={17} width={2} height={11} fill={palette.white} />
      <Pixel x={10} y={17} width={3} height={10} fill={color.shade} />
      <Pixel x={19} y={17} width={3} height={10} fill={color.shade} />
      <Pixel x={12} y={22} width={3} height={2} fill={palette.white} />
    </>,
    overalls: <>
      <Pixel x={11} y={17} width={10} height={5} fill={palette.white} />
      <Pixel x={12} y={20} width={8} height={9} fill={color.shade} />
      <Pixel x={12} y={17} width={2} height={5} fill={color.shade} />
      <Pixel x={18} y={17} width={2} height={5} fill={color.shade} />
      <Pixel x={15} y={22} width={3} height={3} fill={color.main} />
    </>,
  };
  return <g data-avatar-layer="outfit" data-avatar-part={kind}>{common}{details[kind]}</g>;
}

function Accessory({ kind, accent }: {
  kind: 'none' | 'terminal' | 'keyboard' | 'coffee' | 'book' | 'duck' | 'usb';
  accent: keyof Pick<typeof palette, 'yellow' | 'pink' | 'mint' | 'sky'>;
}) {
  const color = palette[accent];
  const variants: Record<typeof kind, ReactNode> = {
    none: null,
    terminal: <>
      <Pixel x={5} y={23} width={22} height={9} fill={palette.outline} />
      <Pixel x={6} y={24} width={20} height={6} fill={palette.shadow} />
      <Pixel x={8} y={26} width={5} fill={color.main} />
      <Pixel x={13} y={27} width={4} fill={color.main} />
      <Pixel x={7} y={31} width={18} height={2} fill={color.shade} />
    </>,
    keyboard: <>
      <Pixel x={4} y={25} width={24} height={7} fill={palette.outline} />
      <Pixel x={5} y={26} width={22} height={5} fill={palette.shadow} />
      {[7, 10, 13, 16, 19, 22].map((x) => <Pixel key={x} x={x} y={27} width={2} fill={color.main} />)}
      {[8, 12, 16, 20].map((x) => <Pixel key={x} x={x} y={29} width={2} fill={palette.white} />)}
    </>,
    coffee: <>
      <Pixel x={22} y={23} width={7} height={8} fill={palette.outline} />
      <Pixel x={23} y={24} width={5} height={6} fill={palette.white} />
      <Pixel x={28} y={25} width={3} height={4} fill={palette.outline} />
      <Pixel x={24} y={24} width={3} fill={color.shade} />
      <Pixel x={24} y={21} height={2} fill={color.main} />
      <Pixel x={27} y={20} height={3} fill={color.main} />
    </>,
    book: <>
      <Pixel x={5} y={22} width={22} height={10} fill={palette.outline} />
      <Pixel x={6} y={23} width={9} height={8} fill={color.main} />
      <Pixel x={17} y={23} width={9} height={8} fill={color.main} />
      <Pixel x={15} y={23} width={2} height={9} fill={palette.white} />
      <Pixel x={8} y={25} width={5} fill={color.shade} />
      <Pixel x={19} y={25} width={5} fill={color.shade} />
    </>,
    duck: <>
      <Pixel x={21} y={23} width={8} height={7} fill={palette.outline} />
      <Pixel x={23} y={21} width={5} height={5} fill={palette.outline} />
      <Pixel x={24} y={22} width={3} height={4} fill={palette.yellow.main} />
      <Pixel x={22} y={24} width={6} height={5} fill={palette.yellow.main} />
      <Pixel x={27} y={23} width={3} height={2} fill={palette.yellow.shade} />
      <Pixel x={26} y={22} fill={palette.outline} />
    </>,
    usb: <>
      <Pixel x={23} y={23} width={6} height={9} fill={palette.outline} />
      <Pixel x={24} y={24} width={4} height={6} fill={color.main} />
      <Pixel x={25} y={21} width={2} height={3} fill={palette.white} />
      <Pixel x={25} y={21} width={1} fill={palette.shadow} />
      <Pixel x={27} y={21} width={1} fill={palette.shadow} />
    </>,
  };
  return <g data-avatar-layer="accessory" data-avatar-part={kind}>{variants[kind]}</g>;
}

function Accent({ color }: { color: 'yellow' | 'pink' | 'mint' | 'sky' }) {
  const accent = palette[color];
  return <g data-avatar-layer="accent" data-avatar-part={color}>
    <Pixel x={3} y={9} width={2} height={2} fill={accent.main} />
    <Pixel x={4} y={8} width={1} height={4} fill={accent.main} />
    <Pixel x={28} y={13} width={2} height={2} fill={accent.main} />
    <Pixel x={29} y={12} width={1} height={4} fill={accent.main} />
    <Pixel x={3} y={32} width={1} height={2} fill={accent.shade} />
  </g>;
}

export function PixelAvatar({ traits, nickname, size = 128 }: { traits: Traits; nickname: string; size?: number }) {
  const parts = layeredAvatarParts(traits);
  const developerClass = traits.developerAdjective && traits.developerNoun
    ? `, ${traits.developerAdjective} ${traits.developerNoun}`
    : '';
  const description = `${nickname}의 픽셀 캐릭터, 전신 개발자 아바타${developerClass}`;

  return <span
    style={{ width: size, height: size }}
    className="relative mx-auto inline-block shrink-0 overflow-hidden border-4 border-[#11162b] bg-[radial-gradient(circle_at_50%_80%,#27365f_0_18%,transparent_19%),linear-gradient(#111a35,#090d19)] shadow-[3px_3px_0_#817a9c]"
  >
    <svg
      role="img"
      aria-label={description}
      viewBox="0 0 32 40"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 block [image-rendering:pixelated]"
      shapeRendering="crispEdges"
      data-avatar-combination={`${parts.body}:${parts.hair}:${parts.outfit}:${parts.accessory}:${parts.accent}`}
    >
      <Body tone={parts.body} />
      <Hair kind={parts.hair} />
      <Outfit kind={parts.outfit} accent={parts.accent} />
      <Accessory kind={parts.accessory} accent={parts.accent} />
      <Accent color={parts.accent} />
    </svg>
  </span>;
}
