import Link from 'next/link';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import { LogoutButton } from '@/components/forms/ParticipantAuthForm';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { requireParticipant } from '@/lib/auth/authorization';
import { lobbyView } from '@/lib/auth/participant-service';

export default async function LobbyPage() {
  const { participant } = await requireParticipant();
  const lobby = await lobbyView(participant.id);
  const status = lobby.answerStatus === 'submitted' ? '기록 완료' : lobby.answerStatus === 'not-submitted' ? '아직 기록하지 않았어요' : '3주년 질문 준비 중';
  return <main className="game-shell"><GamePanel title="Party Lobby"><div className="lobby-grid">
    <PixelAvatar nickname={lobby.nickname} traits={lobby.avatar.traits} />
    <div><p className="pixel-title text-sm text-[var(--pink)]">Player</p><h1 className="mt-2 text-2xl font-bold">{lobby.nickname}님의 로비</h1><p className="mt-3 text-[var(--muted)]">캐릭터가 준비됐어요. 이 모습은 같은 닉네임과 생성 규칙에서 계속 유지됩니다.</p></div>
  </div></GamePanel><GamePanel title="Quest Log"><p>{status}</p>
    {lobby.answerStatus === 'question-unavailable'
      ? <p className="mt-2 text-sm text-[var(--muted)]">질문이 공개되면 이곳에 입구가 열립니다.</p>
      : <Link className="game-button mt-5" href="/memory">네 질문 작성하기</Link>}
    <Link className="memory-back-link mt-4" href="/answers">질답 기록 보기</Link>
    <div className="mt-6"><LogoutButton /></div></GamePanel></main>;
}
