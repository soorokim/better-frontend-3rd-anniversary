'use client';

import { useState } from 'react';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import { PinResetDialog } from './PinResetDialog';

export type AdminParticipant = { id: string; nickname: string; joinedAt: string | Date; answerStatus: 'submitted' | 'not-submitted'; avatar: { generatorVersion: string; catalogVersion: string; traits: Record<string, string> } | null };

export function ParticipantList({ participants }: { participants: AdminParticipant[] }) {
  const [selected, setSelected] = useState<AdminParticipant>();
  if (!participants.length) return <div className="admin-empty"><p className="pixel-title text-[var(--yellow)]">No Players Yet</p><p>아직 입장한 참가자가 없어요. 초대 코드를 전달한 뒤 이 화면을 새로고침해 주세요.</p></div>;
  return <><ul className="participant-list" aria-label="참가자 제출 현황">{participants.map((participant) => <li key={participant.id} className="participant-card">
    {participant.avatar ? <PixelAvatar nickname={participant.nickname} traits={participant.avatar.traits} size={76} /> : <div className="avatar-placeholder" aria-label={`${participant.nickname}의 캐릭터 준비 중`} />}
    <div className="min-w-0"><strong>{participant.nickname}</strong><p className={participant.answerStatus === 'submitted' ? 'text-[var(--mint)]' : 'text-[var(--muted)]'}>{participant.answerStatus === 'submitted' ? '답변 제출 완료' : '아직 제출하지 않음'}</p><p className="text-xs text-[var(--muted)]">입장 {new Date(participant.joinedAt).toLocaleDateString('ko-KR')}</p></div>
    <button className="game-button secondary" type="button" aria-label={`${participant.nickname} PIN 초기화`} onClick={() => setSelected(participant)}>PIN 초기화</button>
  </li>)}</ul>{selected ? <PinResetDialog participant={selected} onClose={() => setSelected(undefined)} /> : null}</>;
}
