'use client';

import { useMemo, useState } from 'react';
import { approvedStatuses } from '@/lib/avatar/presentation';

type Traits = Record<string, string>;

function isDeveloperProfile(traits: Traits) {
  return Boolean(
    traits.developerItem
      && traits.developerStatus
      && traits.developerHash,
  );
}

export function DeveloperIdentityCard({ nickname, traits }: { nickname: string; traits: Traits }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const statuses = useMemo(() => approvedStatuses(traits), [traits]);
  if (!isDeveloperProfile(traits)) return null;

  const developerClass = traits.developerAdjective && traits.developerNoun
    ? `${traits.developerAdjective} ${traits.developerNoun}`
    : '—';
  const status = statuses[statusIndex % statuses.length] ?? traits.developerStatus;

  return <section className="developer-profile" aria-label={`${nickname}의 개발자 프로필`}>
    <button
      type="button"
      className="developer-card"
      onClick={() => setStatusIndex((index) => index + 1)}
      aria-label={`${nickname} 개발자 카드. 누르면 상태 메시지가 바뀝니다.`}
    >
      <dl>
        <div><dt>PLAYER</dt><dd>{nickname}</dd></div>
        <div><dt>CLASS</dt><dd>{developerClass}</dd></div>
        <div><dt>ITEM</dt><dd>{traits.developerItem}</dd></div>
        <div><dt>STATUS</dt><dd aria-live="polite" aria-atomic="true">{status}</dd></div>
        <div><dt>HASH</dt><dd>{traits.developerHash}</dd></div>
      </dl>
      <span className="developer-card-hint" aria-hidden="true">CLICK TO PING</span>
    </button>
  </section>;
}
