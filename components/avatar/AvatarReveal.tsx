'use client';

import { useEffect, useState } from 'react';
import { revealMessages, temporaryRevealTraits } from '@/lib/avatar/presentation';
import { DeveloperIdentityCard } from './DeveloperIdentityCard';
import { PixelAvatar } from './PixelAvatar';

type Stage = 'shuffling' | 'ready' | 'reduced-motion-ready';

export function AvatarReveal({
  nickname,
  traits,
  reveal,
}: {
  nickname: string;
  traits: Record<string, string>;
  reveal: boolean;
}) {
  const [stage, setStage] = useState<Stage>(reveal ? 'shuffling' : 'ready');
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!reveal) return;
    window.history.replaceState(window.history.state, '', '/lobby');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      const reducedMotionTimeout = window.setTimeout(() => setStage('reduced-motion-ready'), 0);
      return () => window.clearTimeout(reducedMotionTimeout);
    }
    const interval = window.setInterval(() => setFrame((value) => value + 1), 360);
    const random = new Uint32Array(1);
    window.crypto.getRandomValues(random);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setStage('ready');
    }, 3000 + (random[0] % 2001));
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [reveal]);

  const shuffling = stage === 'shuffling';
  const visibleTraits = shuffling ? temporaryRevealTraits(frame) : traits;
  const message = shuffling ? revealMessages[frame % revealMessages.length] : '✓ PLAYER READY';

  return <section className={`avatar-reveal avatar-reveal-${stage}`} aria-label={`${nickname}의 캐릭터 공개`}>
    {reveal ? <div className="terminal-reveal" aria-live="polite" aria-atomic="true">
      <p className="terminal-line">$ initializing player...</p>
      <p className="terminal-line">$ resolving developer traits...</p>
      <p className="terminal-line">$ {message}</p>
    </div> : null}
    <div className="lobby-grid">
      <PixelAvatar nickname={nickname} traits={visibleTraits} />
      <div>
        <p className="pixel-title text-sm text-[var(--pink)]">Player</p>
        <h1 className="mt-2 text-2xl font-bold">{nickname}님의 로비</h1>
        <p className="mt-3 text-[var(--muted)]">{shuffling ? message : '단톡방에서 쌓인 활동 특징으로 캐릭터를 찾았어요.'}</p>
      </div>
    </div>
    <DeveloperIdentityCard nickname={nickname} traits={visibleTraits} />
  </section>;
}
