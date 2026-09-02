'use client';

import { useMemo, useState } from 'react';
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

export function DeveloperIdentityCard({ nickname, traits }: { nickname: string; traits: Traits }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [classGuideOpen, setClassGuideOpen] = useState(false);
  const statuses = useMemo(() => approvedStatuses(traits), [traits]);
  if (!isDeveloperProfile(traits)) return null;

  const developerClass = traits.developerAdjective && traits.developerNoun
    ? `${traits.developerAdjective} ${traits.developerNoun}`
    : '—';
  const status = statuses[statusIndex % statuses.length] ?? traits.developerStatus;
  const classGuide = guideFor(traits.developerAdjective, traits.developerNoun);
  const adjectiveLabel = traits.developerAdjective ?? '작업 스타일';
  const nounLabel = traits.developerNoun ?? '역할 키워드';

  return <section className="developer-profile" aria-label={`${nickname}의 개발자 프로필`}>
    <button
      type="button"
      className="developer-card"
      onClick={() => setStatusIndex((index) => index + 1)}
      aria-label={`${nickname} 개발자 카드. 누르면 상태 메시지가 바뀝니다.`}
      aria-describedby="developer-class-tooltip"
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
    <div className="developer-item-reason">
      <button type="button" className="developer-reason-button" onClick={() => setClassGuideOpen((open) => !open)} aria-expanded={classGuideOpen} aria-controls="developer-class-guide-detail">
        {classGuideOpen ? '클래스 설명 닫기' : '클래스 설명'}
      </button>
      <button
        type="button"
        className="developer-reason-button"
        onClick={() => setReasonOpen((open) => !open)}
        aria-expanded={reasonOpen}
        aria-controls="developer-item-reason-detail"
      >
        {reasonOpen ? '선정 이유 닫기' : '아이템 선정 이유'}
      </button>
      {reasonOpen ? <p id="developer-item-reason-detail" className="developer-reason-detail" aria-live="polite">
        {traits.developerItemReason ?? '대화에서 보인 여러 특징을 바탕으로 고른 아이템이에요.'}
      </p> : null}
      {classGuideOpen ? <p id="developer-class-guide-detail" className="developer-reason-detail">{classGuide.adjective} {classGuide.noun}</p> : null}
    </div>
    <aside id="developer-class-tooltip" className="developer-class-tooltip" role="tooltip">
      <p className="pixel-title">CLASS GUIDE</p>
      <p><strong>{developerClass}</strong>는 단톡방 대화에서 정리한 키워드를 조합한 별명이에요.</p>
      <ul>
        <li><strong>{adjectiveLabel}</strong>: {classGuide.adjective}</li>
        <li><strong>{nounLabel}</strong>: {classGuide.noun}</li>
        <li>후보 중 하나를 프로필 해시로 고정해, 다시 입장해도 같은 클래스가 유지돼요.</li>
      </ul>
      <p className="developer-class-note">활동량 순위나 실력 평가와는 관계없어요.</p>
    </aside>
  </section>;
}
