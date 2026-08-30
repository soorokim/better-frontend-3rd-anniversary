import Link from 'next/link';
import { AvatarReveal } from '@/components/avatar/AvatarReveal';
import { LogoutButton } from '@/components/forms/ParticipantAuthForm';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { requireParticipant } from '@/lib/auth/authorization';
import { lobbyView } from '@/lib/auth/participant-service';

export default async function LobbyPage({ searchParams }: { searchParams: Promise<{ reveal?: string }> }) {
  const { participant } = await requireParticipant();
  const lobby = await lobbyView(participant.id);
  const reveal = (await searchParams).reveal === '1';
  const status = lobby.answerStatus === 'submitted' ? '기록 완료' : lobby.answerStatus === 'not-submitted' ? '아직 기록하지 않았어요' : '3주년 질문 준비 중';
  return <main className="game-shell"><GamePanel title="Party Lobby"><AvatarReveal nickname={lobby.nickname} traits={lobby.avatar.traits} reveal={reveal} /></GamePanel><GamePanel title="Quest Log"><p>{status}</p>
    {lobby.answerStatus === 'question-unavailable'
      ? <p className="mt-2 text-sm text-[var(--muted)]">질문이 공개되면 이곳에 입구가 열립니다.</p>
      : <Link className="game-button mt-5" href="/memory">{lobby.answerStatus === 'submitted' ? '3주년 기록 수정하기' : '3주년 기록 남기기'}</Link>}
    <div className="mt-6"><LogoutButton /></div></GamePanel></main>;
}
