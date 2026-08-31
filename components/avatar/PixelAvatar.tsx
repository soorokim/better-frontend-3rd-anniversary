import type { ReactNode } from 'react';
import { layeredAvatarParts, type LayeredAvatarParts } from '@/lib/avatar/presentation';

type Traits = Record<string, string>;
type SkinTone = 'light' | 'warm' | 'deep';
type AccentColor = 'yellow' | 'pink' | 'mint' | 'sky';
type AccessoryKind = LayeredAvatarParts['accessory'];

const palette = {
  outline: '#080d24', outlineSoft: '#17213f', shadow: '#111a35', trouser: '#23375f',
  denim: '#355785', shoe: '#090d19', sole: '#e8e8df', white: '#f4f0e8', screen: '#0b1730',
  red: '#f05b72', green: '#63d59f', purple: '#9b72e8', cyan: '#5bd8e8',
  light: { skin: '#ffd0ad', shade: '#e89b7f', glow: '#ffe2c8' },
  warm: { skin: '#c97d56', shade: '#8e4d3b', glow: '#e4a47c' },
  deep: { skin: '#794536', shade: '#4f2b2a', glow: '#a96850' },
  yellow: { main: '#ffe657', shade: '#d59c32', dark: '#8d6325' },
  pink: { main: '#f27cac', shade: '#a8427a', dark: '#692951' },
  mint: { main: '#62d5aa', shade: '#278b79', dark: '#18584f' },
  sky: { main: '#62b8e9', shade: '#316aa3', dark: '#244974' },
} as const;

const hairPalette: Record<AccentColor, { main: string; shade: string; shine: string }> = {
  yellow: { main: '#4b302d', shade: '#2a2029', shine: '#7e5140' },
  pink: { main: '#3c2946', shade: '#211b32', shine: '#745075' },
  mint: { main: '#182f4d', shade: '#101a31', shine: '#315b79' },
  sky: { main: '#23242f', shade: '#111521', shine: '#505262' },
};

function Pixel({ x, y, width = 1, height = 1, fill }: {
  x: number; y: number; width?: number; height?: number; fill: string;
}) {
  return <rect x={x} y={y} width={width} height={height} fill={fill} />;
}

function Body({ tone }: { tone: SkinTone }) {
  const skin = palette[tone];
  return <g data-avatar-layer="body">
    <Pixel x={10} y={10} width={5} height={10} fill={palette.outline} />
    <Pixel x={34} y={10} width={5} height={10} fill={palette.outline} />
    <Pixel x={13} y={5} width={23} height={18} fill={palette.outline} />
    <Pixel x={11} y={12} width={4} height={6} fill={skin.skin} />
    <Pixel x={34} y={12} width={4} height={6} fill={skin.shade} />
    <Pixel x={14} y={6} width={20} height={16} fill={skin.skin} />
    <Pixel x={31} y={7} width={3} height={14} fill={skin.shade} />
    <Pixel x={15} y={7} width={14} height={2} fill={skin.glow} />
    <Pixel x={17} y={12} width={5} height={2} fill={palette.outlineSoft} />
    <Pixel x={27} y={12} width={4} height={2} fill={palette.outlineSoft} />
    <Pixel x={18} y={14} width={3} height={4} fill={palette.outline} />
    <Pixel x={28} y={14} width={3} height={4} fill={palette.outline} />
    <Pixel x={19} y={14} fill={palette.white} />
    <Pixel x={29} y={14} fill={palette.white} />
    <Pixel x={24} y={16} width={2} height={2} fill={skin.shade} />
    <Pixel x={21} y={19} width={7} height={2} fill={palette.outlineSoft} />
    <Pixel x={23} y={19} width={3} fill={palette.white} />
    <Pixel x={21} y={22} width={8} height={5} fill={palette.outline} />
    <Pixel x={22} y={22} width={6} height={4} fill={skin.skin} />
    <Pixel x={6} y={27} width={8} height={16} fill={palette.outline} />
    <Pixel x={35} y={27} width={8} height={16} fill={palette.outline} />
    <Pixel x={7} y={29} width={6} height={13} fill={skin.skin} />
    <Pixel x={36} y={29} width={6} height={13} fill={skin.shade} />
    <Pixel x={5} y={40} width={9} height={7} fill={palette.outline} />
    <Pixel x={35} y={40} width={9} height={7} fill={palette.outline} />
    <Pixel x={6} y={41} width={7} height={5} fill={skin.skin} />
    <Pixel x={36} y={41} width={7} height={5} fill={skin.shade} />
    <Pixel x={14} y={42} width={10} height={12} fill={palette.outline} />
    <Pixel x={26} y={42} width={10} height={12} fill={palette.outline} />
  </g>;
}

function Hair({ kind, accent }: { kind: 'short' | 'wave' | 'bob' | 'spike' | 'cap'; accent: AccentColor }) {
  const hair = hairPalette[accent];
  const variants: Record<typeof kind, ReactNode> = {
    short: <>
      <Pixel x={12} y={3} width={25} height={7} fill={palette.outline} /><Pixel x={11} y={6} width={5} height={9} fill={palette.outline} />
      <Pixel x={14} y={4} width={21} height={6} fill={hair.main} /><Pixel x={12} y={7} width={5} height={7} fill={hair.main} />
      <Pixel x={16} y={3} width={9} height={2} fill={hair.shine} /><Pixel x={30} y={8} width={5} height={3} fill={hair.shade} />
    </>,
    wave: <>
      <Pixel x={11} y={3} width={26} height={8} fill={palette.outline} /><Pixel x={9} y={8} width={7} height={19} fill={palette.outline} /><Pixel x={34} y={8} width={6} height={19} fill={palette.outline} />
      <Pixel x={12} y={4} width={23} height={7} fill={hair.main} /><Pixel x={10} y={9} width={5} height={17} fill={hair.main} /><Pixel x={35} y={9} width={4} height={17} fill={hair.shade} />
      <Pixel x={13} y={5} width={8} height={2} fill={hair.shine} /><Pixel x={10} y={22} width={3} height={6} fill={hair.shade} /><Pixel x={37} y={22} width={3} height={6} fill={hair.main} />
    </>,
    bob: <>
      <Pixel x={10} y={3} width={28} height={9} fill={palette.outline} /><Pixel x={9} y={9} width={7} height={19} fill={palette.outline} /><Pixel x={34} y={9} width={7} height={19} fill={palette.outline} />
      <Pixel x={11} y={4} width={25} height={8} fill={hair.main} /><Pixel x={10} y={10} width={5} height={17} fill={hair.main} /><Pixel x={35} y={10} width={5} height={17} fill={hair.shade} />
      <Pixel x={14} y={4} width={9} height={2} fill={hair.shine} /><Pixel x={11} y={25} width={7} height={3} fill={hair.shade} /><Pixel x={32} y={25} width={8} height={3} fill={hair.main} />
    </>,
    spike: <>
      <Pixel x={12} y={4} width={25} height={8} fill={palette.outline} /><Pixel x={11} y={2} width={6} height={7} fill={palette.outline} /><Pixel x={18} y={0} width={6} height={8} fill={palette.outline} /><Pixel x={25} y={2} width={6} height={6} fill={palette.outline} /><Pixel x={32} y={1} width={5} height={8} fill={palette.outline} />
      <Pixel x={13} y={5} width={22} height={6} fill={hair.main} /><Pixel x={12} y={3} width={4} height={5} fill={hair.main} /><Pixel x={19} y={1} width={4} height={7} fill={hair.main} /><Pixel x={26} y={3} width={4} height={5} fill={hair.shine} /><Pixel x={33} y={2} width={3} height={6} fill={hair.shade} />
    </>,
    cap: <>
      <Pixel x={12} y={4} width={25} height={7} fill={palette.outline} /><Pixel x={10} y={9} width={17} height={4} fill={palette.outline} /><Pixel x={15} y={2} width={19} height={4} fill={palette.outline} />
      <Pixel x={13} y={5} width={23} height={5} fill={hair.main} /><Pixel x={11} y={10} width={16} height={2} fill={palette[accent].main} /><Pixel x={16} y={3} width={17} height={3} fill={palette[accent].shade} /><Pixel x={30} y={6} width={5} height={4} fill={hair.shade} />
    </>,
  };
  return <g data-avatar-layer="hair" data-avatar-part={kind}>{variants[kind]}</g>;
}

function Outfit({ kind, accent }: { kind: 'hoodie' | 'sweater' | 'jacket' | 'overalls'; accent: AccentColor }) {
  const color = palette[accent];
  const common = <>
    <Pixel x={11} y={24} width={28} height={20} fill={palette.outline} /><Pixel x={12} y={25} width={26} height={18} fill={color.main} />
    <Pixel x={6} y={27} width={7} height={14} fill={palette.outline} /><Pixel x={37} y={27} width={7} height={14} fill={palette.outline} />
    <Pixel x={7} y={28} width={6} height={12} fill={color.shade} /><Pixel x={37} y={28} width={6} height={12} fill={color.shade} />
    <Pixel x={13} y={42} width={24} height={5} fill={palette.outline} /><Pixel x={14} y={43} width={22} height={4} fill={palette.trouser} />
    <Pixel x={13} y={46} width={11} height={9} fill={palette.outline} /><Pixel x={26} y={46} width={11} height={9} fill={palette.outline} />
    <Pixel x={14} y={46} width={9} height={7} fill={palette.denim} /><Pixel x={27} y={46} width={9} height={7} fill={palette.denim} />
    <Pixel x={11} y={52} width={13} height={5} fill={palette.shoe} /><Pixel x={26} y={52} width={13} height={5} fill={palette.shoe} />
    <Pixel x={12} y={55} width={12} height={2} fill={palette.sole} /><Pixel x={26} y={55} width={12} height={2} fill={palette.sole} />
  </>;
  const details: Record<typeof kind, ReactNode> = {
    hoodie: <><Pixel x={16} y={23} width={18} height={5} fill={color.dark} /><Pixel x={19} y={24} width={12} height={3} fill={palette.shadow} /><Pixel x={21} y={27} width={2} height={8} fill={palette.white} /><Pixel x={28} y={27} width={2} height={8} fill={palette.white} /><Pixel x={18} y={36} width={14} height={5} fill={color.shade} /><Pixel x={20} y={36} width={10} height={2} fill={color.dark} /></>,
    sweater: <><Pixel x={12} y={29} width={26} height={3} fill={color.shade} /><Pixel x={12} y={35} width={26} height={3} fill={color.shade} /><Pixel x={12} y={41} width={26} height={3} fill={color.dark} /><Pixel x={19} y={25} width={12} height={3} fill={palette.white} /><Pixel x={22} y={31} width={6} height={4} fill={palette.white} /></>,
    jacket: <><Pixel x={23} y={25} width={4} height={18} fill={palette.white} /><Pixel x={12} y={25} width={9} height={17} fill={color.shade} /><Pixel x={29} y={25} width={9} height={17} fill={color.shade} /><Pixel x={17} y={31} width={5} height={3} fill={palette.white} /><Pixel x={29} y={31} width={5} height={3} fill={palette.white} /><Pixel x={24} y={28} width={2} height={2} fill={color.dark} /><Pixel x={24} y={35} width={2} height={2} fill={color.dark} /></>,
    overalls: <><Pixel x={12} y={25} width={26} height={7} fill={palette.white} /><Pixel x={16} y={29} width={18} height={14} fill={color.shade} /><Pixel x={16} y={25} width={4} height={9} fill={color.dark} /><Pixel x={30} y={25} width={4} height={9} fill={color.dark} /><Pixel x={19} y={33} width={12} height={7} fill={color.main} /><Pixel x={23} y={35} width={4} height={3} fill={color.dark} /></>,
  };
  return <g data-avatar-layer="outfit" data-avatar-part={kind}>{common}{details[kind]}</g>;
}

function ItemHands({ tone, left = true, right = true }: { tone: SkinTone; left?: boolean; right?: boolean }) {
  const skin = palette[tone];
  return <>
    {left ? <><Pixel x={5} y={39} width={8} height={7} fill={palette.outline} /><Pixel x={6} y={40} width={7} height={5} fill={skin.skin} /></> : null}
    {right ? <><Pixel x={36} y={39} width={8} height={7} fill={palette.outline} /><Pixel x={36} y={40} width={7} height={5} fill={skin.shade} /></> : null}
  </>;
}

function Accessory({ kind, accent, tone }: { kind: AccessoryKind; accent: AccentColor; tone: SkinTone }) {
  const color = palette[accent];
  const laptop = <>
    <Pixel x={5} y={31} width={40} height={15} fill={palette.outline} /><Pixel x={7} y={33} width={36} height={11} fill={palette.screen} />
    <Pixel x={10} y={35} width={8} height={2} fill={color.main} /><Pixel x={10} y={39} width={14} height={2} fill={palette.cyan} />
    <Pixel x={27} y={35} width={12} height={6} fill={palette.outlineSoft} /><Pixel x={30} y={36} width={6} height={4} fill={color.shade} />
    <Pixel x={3} y={46} width={44} height={3} fill={palette.outline} /><Pixel x={7} y={46} width={36} fill={palette.sole} /><ItemHands tone={tone} />
  </>;
  const variants: Record<AccessoryKind, ReactNode> = {
    none: null, terminal: laptop, laptop,
    keyboard: <><Pixel x={3} y={36} width={44} height={12} fill={palette.outline} /><Pixel x={5} y={38} width={40} height={8} fill={palette.screen} />{[7, 12, 17, 22, 27, 32, 37].map((x, index) => <Pixel key={`top-${x}`} x={x} y={39} width={3} height={2} fill={index % 2 ? color.main : palette.cyan} />)}{[9, 15, 21, 27, 33, 39].map((x) => <Pixel key={`bottom-${x}`} x={x} y={43} width={4} height={2} fill={palette.white} />)}<ItemHands tone={tone} /></>,
    coffee: <><Pixel x={35} y={31} width={10} height={14} fill={palette.outline} /><Pixel x={37} y={33} width={7} height={10} fill={palette.white} /><Pixel x={44} y={34} width={4} height={7} fill={palette.outline} /><Pixel x={38} y={33} width={5} height={2} fill={color.shade} /><Pixel x={37} y={27} width={2} height={4} fill={palette.white} /><Pixel x={41} y={25} width={2} height={6} fill={palette.white} /><ItemHands tone={tone} left={false} /></>,
    book: <><Pixel x={4} y={32} width={42} height={14} fill={palette.outline} /><Pixel x={6} y={34} width={17} height={10} fill={color.main} /><Pixel x={27} y={34} width={17} height={10} fill={color.main} /><Pixel x={23} y={33} width={4} height={13} fill={palette.white} /><Pixel x={9} y={36} width={10} height={2} fill={color.dark} /><Pixel x={30} y={36} width={10} height={2} fill={color.dark} /><Pixel x={9} y={40} width={7} height={2} fill={palette.white} /><Pixel x={33} y={40} width={7} height={2} fill={palette.white} /><ItemHands tone={tone} /></>,
    duck: <><Pixel x={33} y={34} width={13} height={10} fill={palette.outline} /><Pixel x={36} y={30} width={8} height={8} fill={palette.outline} /><Pixel x={37} y={31} width={6} height={7} fill={palette.yellow.main} /><Pixel x={34} y={35} width={11} height={8} fill={palette.yellow.main} /><Pixel x={43} y={33} width={5} height={3} fill={palette.yellow.shade} /><Pixel x={41} y={32} width={2} height={2} fill={palette.outline} /><Pixel x={35} y={39} width={4} height={2} fill={palette.yellow.shade} /><ItemHands tone={tone} left={false} /></>,
    usb: <><Pixel x={37} y={29} width={8} height={16} fill={palette.outline} /><Pixel x={39} y={31} width={4} height={11} fill={color.main} /><Pixel x={39} y={25} width={5} height={6} fill={palette.sole} /><Pixel x={40} y={26} height={3} fill={palette.shadow} /><Pixel x={43} y={26} height={3} fill={palette.shadow} /><Pixel x={40} y={35} width={2} height={2} fill={palette.white} /><ItemHands tone={tone} left={false} /></>,
    'error-log': <><Pixel x={3} y={29} width={17} height={18} fill={palette.outline} /><Pixel x={5} y={31} width={13} height={14} fill={palette.red} /><Pixel x={7} y={33} width={9} height={2} fill={palette.white} /><Pixel x={8} y={37} width={2} height={5} fill={palette.white} /><Pixel x={13} y={37} width={2} height={5} fill={palette.white} /><Pixel x={9} y={39} width={5} height={2} fill={palette.white} /><ItemHands tone={tone} right={false} /></>,
    'test-check': <><Pixel x={31} y={28} width={16} height={19} fill={palette.outline} /><Pixel x={33} y={30} width={12} height={15} fill={palette.green} /><Pixel x={35} y={32} width={8} height={2} fill={palette.white} /><Pixel x={35} y={38} width={3} height={3} fill={palette.white} /><Pixel x={38} y={40} width={3} height={3} fill={palette.white} /><Pixel x={41} y={36} width={3} height={5} fill={palette.white} /><ItemHands tone={tone} left={false} /></>,
    'browser-tabs': <><Pixel x={4} y={27} width={17} height={15} fill={palette.outline} /><Pixel x={7} y={30} width={17} height={15} fill={palette.purple} /><Pixel x={10} y={33} width={17} height={15} fill={palette.outline} /><Pixel x={12} y={35} width={13} height={11} fill={palette.screen} /><Pixel x={12} y={35} width={13} height={3} fill={color.main} /><Pixel x={14} y={40} width={8} height={2} fill={palette.cyan} /><Pixel x={14} y={43} width={5} height={2} fill={palette.white} /><ItemHands tone={tone} right={false} /></>,
  };
  return <g data-avatar-layer="accessory" data-avatar-part={kind}>{variants[kind]}</g>;
}

function Accent({ color }: { color: AccentColor }) {
  const accent = palette[color];
  return <g data-avatar-layer="accent" data-avatar-part={color}>
    <Pixel x={2} y={13} width={2} height={4} fill={accent.main} /><Pixel x={0} y={14} width={6} height={2} fill={accent.main} />
    <Pixel x={44} y={17} width={2} height={4} fill={accent.main} /><Pixel x={42} y={18} width={6} height={2} fill={accent.main} />
    <Pixel x={3} y={51} width={2} height={3} fill={accent.shade} /><Pixel x={44} y={49} width={2} height={3} fill={accent.shade} />
  </g>;
}

export function PixelAvatar({ traits, nickname, size = 144 }: { traits: Traits; nickname: string; size?: number }) {
  const parts = layeredAvatarParts(traits);
  const developerClass = traits.developerAdjective && traits.developerNoun ? `, ${traits.developerAdjective} ${traits.developerNoun}` : '';
  const itemDescription = traits.developerItem ? `, 장착 아이템 ${traits.developerItem}` : '';
  const description = `${nickname}의 픽셀 캐릭터, 전신 개발자 아바타${developerClass}${itemDescription}`;

  return <span style={{ width: size, height: size }} className="relative mx-auto inline-block shrink-0 overflow-hidden border-4 border-[#11162b] bg-[radial-gradient(circle_at_50%_82%,#34466f_0_20%,transparent_21%),linear-gradient(#152042,#080d1d)] shadow-[4px_4px_0_#817a9c]">
    <svg role="img" aria-label={description} viewBox="0 0 48 58" width={size} height={size} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 block [image-rendering:pixelated]" shapeRendering="crispEdges" data-avatar-combination={`${parts.body}:${parts.hair}:${parts.outfit}:${parts.accessory}:${parts.accent}`}>
      <Body tone={parts.body} /><Hair kind={parts.hair} accent={parts.accent} /><Outfit kind={parts.outfit} accent={parts.accent} /><Accessory kind={parts.accessory} accent={parts.accent} tone={parts.body} /><Accent color={parts.accent} />
    </svg>
  </span>;
}
