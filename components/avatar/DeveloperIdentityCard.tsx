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

type RoleGuide = { category: string; evidence: string };

const roleGuides: Record<string, RoleGuide> = {
  '마법사': { category: '프론트엔드', evidence: 'CSS·HTML·React·Vue·브라우저처럼 화면을 만드는 주제에서 후보가 만들어져요.' },
  '픽셀 조각가': { category: '프론트엔드', evidence: 'CSS·HTML·React·Vue·브라우저처럼 화면을 만드는 주제에서 후보가 만들어져요. 실제로 픽셀 작업을 했다는 뜻은 아니에요.' },
  '브라우저 조련사': { category: '프론트엔드', evidence: 'CSS·HTML·React·Vue·브라우저처럼 화면을 만드는 주제에서 후보가 만들어져요.' },
  '연금술사': { category: '백엔드', evidence: 'API·서버·데이터베이스처럼 서비스 뒤쪽을 연결하는 주제에서 후보가 만들어져요.' },
  '서버 수호자': { category: '백엔드', evidence: 'API·서버·데이터베이스처럼 서비스 뒤쪽을 연결하는 주제에서 후보가 만들어져요.' },
  'API 항해사': { category: '백엔드', evidence: 'API 요청·응답, 서버와 데이터를 연결하는 주제에서 후보가 만들어져요.' },
  '배포 항해사': { category: '인프라', evidence: 'Docker·Kubernetes·AWS·배포·컨테이너처럼 실행 환경을 다루는 주제에서 후보가 만들어져요.' },
  '컨테이너 조련사': { category: '인프라', evidence: 'Docker·Kubernetes·AWS·배포·컨테이너처럼 실행 환경을 다루는 주제에서 후보가 만들어져요.' },
  '인프라 수호자': { category: '인프라', evidence: 'Docker·Kubernetes·AWS·배포·컨테이너처럼 실행 환경을 다루는 주제에서 후보가 만들어져요.' },
  '버그 사냥꾼': { category: '품질과 문제 해결', evidence: '테스트·버그·에러·디버깅처럼 문제를 확인하고 푸는 주제에서 후보가 만들어져요.' },
  '타입 수호자': { category: '품질과 문제 해결', evidence: '테스트·버그·에러·디버깅처럼 문제를 확인하고 푸는 주제에서 후보가 만들어져요.' },
  '테스트 감별사': { category: '품질과 문제 해결', evidence: '테스트·버그·에러·디버깅처럼 문제를 확인하고 푸는 주제에서 후보가 만들어져요.' },
  '인터페이스 조각가': { category: '디자인과 경험', evidence: 'Figma·UX·UI·디자인·인터페이스처럼 화면 경험을 다듬는 주제에서 후보가 만들어져요.' },
  '픽셀 설계자': { category: '디자인과 경험', evidence: 'Figma·UX·UI·디자인·인터페이스처럼 화면 경험을 다듬는 주제에서 후보가 만들어져요.' },
  '레이아웃 건축가': { category: '디자인과 경험', evidence: 'Figma·UX·UI·디자인·인터페이스처럼 화면 경험을 다듬는 주제에서 후보가 만들어져요.' },
  '커밋 기록관': { category: '도구와 작업 흐름', evidence: 'Git·GitHub·VS Code·IDE·CLI·터미널처럼 도구와 작업 흐름을 다루는 주제에서 후보가 만들어져요.' },
  '터미널 소환사': { category: '도구와 작업 흐름', evidence: 'Git·GitHub·VS Code·IDE·CLI·터미널처럼 도구와 작업 흐름을 다루는 주제에서 후보가 만들어져요.' },
  '도구 수집가': { category: '도구와 작업 흐름', evidence: 'Git·GitHub·VS Code·IDE·CLI·터미널처럼 도구와 작업 흐름을 다루는 주제에서 후보가 만들어져요.' },
  '런타임 탐험가': { category: '실행 환경', evidence: '코드가 실행되는 환경과 동작 원리를 다루는 주제에서 후보가 만들어져요.' },
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
  guideControls = 'bottom',
}: {
  nickname: string;
  traits: Traits;
  /** Roster cards keep the profile visible but do not cycle the private status easter egg. */
  interactive?: boolean;
  /** The owner uses full buttons below the card; public roster entries use compact question-mark controls. */
  guideControls?: 'bottom' | 'icon' | 'none';
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
  const roleGuide = roleGuides[traits.developerNoun ?? ''];
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
        <div><dt>CLASS</dt><dd className="developer-guide-field"><span>{developerClass}</span>{guideControls === 'icon' ? <button type="button" className="developer-guide-button" onClick={(event) => toggleGuide(event, 'class')} aria-label="클래스 설명 보기" aria-expanded={guide === 'class'}>?</button> : null}
          {guide === 'class' && guideControls === 'icon' ? <aside className="developer-guide-tooltip" role="tooltip"><p className="pixel-title">CLASS GUIDE</p><p><strong>{developerClass}</strong>는 대화 원문이 아니라, 주제·신호로 만든 후보에서 고정 선택한 별명이에요.</p><ul><li><strong>{adjectiveLabel}</strong>: {classGuide.adjective}</li><li><strong>{nounLabel}</strong>{roleGuide ? ` · ${roleGuide.category}` : ''}: {roleGuide?.evidence ?? classGuide.noun}</li><li>후보 중 하나를 프로필 해시로 고정해, 다시 입장해도 같은 클래스가 유지돼요.</li></ul><p className="developer-class-note">원문·정확한 횟수·활동량 순위나 실력 평가는 공개하거나 사용하지 않아요.</p></aside> : null}
        </dd></div>
        <div><dt>ITEM</dt><dd className="developer-guide-field"><span>{traits.developerItem}</span>{guideControls === 'icon' ? <button type="button" className="developer-guide-button" onClick={(event) => toggleGuide(event, 'item')} aria-label="아이템 선정 이유 보기" aria-expanded={guide === 'item'}>?</button> : null}
          {guide === 'item' && guideControls === 'icon' ? <aside className="developer-guide-tooltip" role="tooltip"><p className="pixel-title">ITEM GUIDE</p><p><strong>{traits.developerItem}</strong>은(는) 이 플레이어의 대화 흐름에서 찾은 장비예요.</p><p>{traits.developerItemReason ?? '대화에서 보인 여러 특징을 바탕으로 고른 아이템이에요.'}</p><p className="developer-class-note">대화 원문이나 활동량 순위는 공개하지 않아요.</p></aside> : null}
        </dd></div>
        <div><dt>STATUS</dt><dd aria-live="polite" aria-atomic="true">{status}</dd></div>
        <div><dt>HASH</dt><dd>{traits.developerHash}</dd></div>
      </dl>
      {interactive ? <span className="developer-card-hint" aria-hidden="true">CLICK TO PING</span> : null}
    </div>
    {guideControls === 'bottom' ? <div className="developer-guide-actions">
      <button type="button" className="developer-guide-action" onClick={(event) => toggleGuide(event, 'class')} aria-label="클래스 설명 보기" aria-expanded={guide === 'class'}>CLASS 설명</button>
      <button type="button" className="developer-guide-action" onClick={(event) => toggleGuide(event, 'item')} aria-label="아이템 선정 이유 보기" aria-expanded={guide === 'item'}>ITEM 설명</button>
      {guide === 'class' ? <aside className="developer-guide-tooltip developer-guide-tooltip-bottom" role="tooltip"><p className="pixel-title">CLASS GUIDE</p><p><strong>{developerClass}</strong>는 대화 원문이 아니라, 주제·신호로 만든 후보에서 고정 선택한 별명이에요.</p><ul><li><strong>{adjectiveLabel}</strong>: {classGuide.adjective}</li><li><strong>{nounLabel}</strong>{roleGuide ? ` · ${roleGuide.category}` : ''}: {roleGuide?.evidence ?? classGuide.noun}</li><li>후보 중 하나를 프로필 해시로 고정해, 다시 입장해도 같은 클래스가 유지돼요.</li></ul><p className="developer-class-note">원문·정확한 횟수·활동량 순위나 실력 평가는 공개하거나 사용하지 않아요.</p></aside> : null}
      {guide === 'item' ? <aside className="developer-guide-tooltip developer-guide-tooltip-bottom" role="tooltip"><p className="pixel-title">ITEM GUIDE</p><p><strong>{traits.developerItem}</strong>은(는) 이 플레이어의 대화 흐름에서 찾은 장비예요.</p><p>{traits.developerItemReason ?? '대화에서 보인 여러 특징을 바탕으로 고른 아이템이에요.'}</p><p className="developer-class-note">대화 원문이나 활동량 순위는 공개하지 않아요.</p></aside> : null}
    </div> : null}
  </section>;
}
