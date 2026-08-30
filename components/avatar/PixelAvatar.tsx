import type { CSSProperties } from 'react';

type Traits = Record<string, string>;
const colors = { yellow:'#ffe95c', pink:'#e779a9', mint:'#65d4a0', sky:'#62b7e8' };
const skin = { light:'#f2c7a5', warm:'#c8875b', deep:'#75472f' };
const hair = { short:'#33251f', wave:'#6b4436', bob:'#20212e', spike:'#c28c45', cap:'#2d3965' };

export function PixelAvatar({ traits, nickname, size = 128 }: { traits: Traits; nickname: string; size?: number }) {
  const style = { '--avatar-accent':colors[traits.accent as keyof typeof colors]??colors.yellow, '--avatar-skin':skin[traits.body as keyof typeof skin]??skin.warm, '--avatar-hair':hair[traits.hair as keyof typeof hair]??hair.short, width:size, height:size } as CSSProperties;
  const description = `${nickname}의 픽셀 캐릭터, ${traits.hair??'기본'} 머리와 ${traits.outfit??'기본'} 옷, ${traits.accessory??'none'} 소품`;
  return <div role="img" aria-label={description} style={style} className="relative mx-auto shrink-0 border-4 border-[#11162b] bg-[#090d19] [image-rendering:pixelated]">
    <span className="absolute left-[32%] top-[18%] h-[39%] w-[36%] bg-[var(--avatar-skin)] shadow-[-8px_0_var(--avatar-hair),8px_0_var(--avatar-hair),0_-8px_var(--avatar-hair)]" />
    <span className="absolute left-[39%] top-[38%] h-[5%] w-[5%] bg-[#17131b] shadow-[16px_0_#17131b]" />
    <span className="absolute bottom-[12%] left-[27%] h-[34%] w-[46%] bg-[var(--avatar-accent)] shadow-[-8px_8px_var(--avatar-accent),8px_8px_var(--avatar-accent)]" />
    <span className="absolute bottom-[5%] left-[31%] h-[9%] w-[12%] bg-[#17131b] shadow-[34px_0_#17131b]" />
    {traits.accessory!=='none'?<span className="absolute bottom-[18%] right-[8%] h-[18%] w-[20%] border-4 border-[#11162b] bg-[var(--yellow)]" />:null}
  </div>;
}
