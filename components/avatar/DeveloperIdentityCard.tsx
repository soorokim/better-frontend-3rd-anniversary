'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { approvedStatuses } from '@/lib/avatar/presentation';

type Traits = Record<string, string>;

const adjectiveGuides: Record<string, string> = {
  '수다스러운': '질문과 답변을 주고받으며 대화 흐름을 활발하게 만든 모습에서 붙은 작업 스타일 키워드예요.',
  '꾸준한': '한 번 시작한 이야기와 작업을 차근차근 이어 가는 모습에서 붙은 작업 스타일 키워드예요.',
  '호기심 많은': '새로운 주제를 발견하면 이유와 동작을 끝까지 궁금해하는 모습에서 붙은 작업 스타일 키워드예요.',
  '침착한': '문제가 생겨도 흐름을 정리하며 해결책을 찾아가는 모습에서 붙은 작업 스타일 키워드예요.',
};

const nounGuides: Record<string, string> = {
  'API 항해사': 'API 요청과 응답, 연동 과정처럼 서비스 사이를 연결하는 주제와 잘 어울리는 역할 키워드예요.',
  '타입 수호자': '타입을 맞추고 오류를 줄이는 이야기와 잘 어울리는 역할 키워드예요.',
  '버그 사냥꾼': '문제의 원인을 찾아 해결하는 이야기와 잘 어울리는 역할 키워드예요.',
  '런타임 탐험가': '코드가 실제로 실행되는 환경과 동작 원리를 파고드는 이야기와 잘 어울리는 역할 키워드예요.',
};

function guideFor(adjective?: string, noun?: string) {
  return {
    adjective: adjectiveGuides[adjective ?? ''] ?? `${adjective ?? '이 작업 스타일'}은 대화에서 보인 작업 분위기를 표현한 키워드예요.`,
    noun: nounGuides[noun ?? ''] ?? `${noun ?? '이 역할'}은 대화에서 자주 보인 기술·역할·관심사를 표현한 키워드예요.`,
  };
}

function isDeveloperProfile(traits: Traits) {
  return Boolean(
    traits.developerItem
      && traits.developerStatus
      && traits.developerHash,
  );
}

export function DeveloperIdentityCard({
  nickname,
  traits,
  interactive = true,
  showGuides = true,
}: {
  nickname: string;
  traits: Traits;
  /** Roster cards keep the profile visible but do not cycle the private status easter egg. */
  interactive?: boolean;
  /** The two explanation controls belong to the owner-facing lobby profile. */
  showGuides?: boolean;
}) {
  const [guide, setGuide] = useState<'class' | 'item' | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const statuses = useMemo(() => approvedStatuses(traits), [traits]);
  useEffect(() => {
    if (!guide) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !cardRef.current?.contains(event.target)) setGuide(null);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [guide]);
  if (!isDeveloperProfile(traits)) return null;

  const developerClass = traits.developerAdjective && traits.developerNoun
    ? `${traits.developerAdjective} ${traits.developerNoun}`
    : '—';
  const classGuide = guideFor(traits.developerAdjective, traits.developerNoun);
  const status = statuses[statusIndex % statuses.length] ?? traits.developerStatus;
  const adjectiveLabel = traits.developerAdjective ?? '작업 스타일';
  const nounLabel = traits.developerNoun ?? '역할 키워드';

  function toggleGuide(event: React.MouseEvent<HTMLButtonElement>, nextGuide: 'class' | 'item') {
    event.stopPropagation();
    setGuide((current) => current === nextGuide ? null : nextGuide);
  }

  const cardInteraction = interactive ? {
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => setStatusIndex((index) => index + 1),
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault(); setStatusIndex((index) => index + 1);
    },
    'aria-label': `${nickname} 개발자 카드. 누르면 상태 메시지가 바뀝니다.`,
  } : {};

  return <section ref={cardRef} className="developer-profile" aria-label={`${nickname}의 개발자 프로필`}>
    <div className={`developer-card${interactive ? '' : ' developer-card-static'}`} {...cardInteraction}>
      <dl>
        <div><dt>PLAYER</dt><dd>{nickname}</dd></div>
        <div><dt>CLASS</dt><dd className="developer-guide-field"><span>{developerClass}</span>{showGuides ? <button type="button" className="developer-guide-button" onClick={(event) => toggleGuide(event, 'class')} aria-label="클래스 설명 보기" aria-expanded={guide === 'class'}>?</button> : null}
          {guide === 'class' ? <aside className="developer-guide-tooltip" role="tooltip"><p className="pixel-title">CLASS GUIDE</p><p><strong>{developerClass}</strong>는 단톡방 대화에서 정리한 키워드를 조합한 별명이에요.</p><ul><li><strong>{adjectiveLabel}</strong>: {classGuide.adjective}</li><li><strong>{nounLabel}</strong>: {classGuide.noun}</li><li>후보 중 하나를 프로필 해시로 고정해, 다시 입장해도 같은 클래스가 유지돼요.</li></ul><p className="developer-class-note">활동량 순위나 실력 평가와는 관계없어요.</p></aside> : null}
        </dd></div>
        <div><dt>ITEM</dt><dd className="developer-guide-field"><span>{traits.developerItem}</span>{showGuides ? <button type="button" className="developer-guide-button" onClick={(event) => toggleGuide(event, 'item')} aria-label="아이템 선정 이유 보기" aria-expanded={guide === 'item'}>?</button> : null}
          {guide === 'item' ? <aside className="developer-guide-tooltip" role="tooltip"><p className="pixel-title">ITEM GUIDE</p><p><strong>{traits.developerItem}</strong>은(는) 이 플레이어의 대화 흐름에서 찾은 장비예요.</p><p>{traits.developerItemReason ?? '대화에서 보인 여러 특징을 바탕으로 고른 아이템이에요.'}</p><p className="developer-class-note">대화 원문이나 활동량 순위는 공개하지 않아요.</p></aside> : null}
        </dd></div>
        <div><dt>STATUS</dt><dd aria-live="polite" aria-atomic="true">{status}</dd></div>
        <div><dt>HASH</dt><dd>{traits.developerHash}</dd></div>
      </dl>
      {interactive ? <span className="developer-card-hint" aria-hidden="true">CLICK TO PING</span> : null}
    </div>
  </section>;
}
