import Link from 'next/link';
import { DeveloperIdentityCard } from '@/components/avatar/DeveloperIdentityCard';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { requireParticipant } from '@/lib/auth/authorization';
import { listParticipantRoster } from '@/lib/db/repositories/participants';

export default async function AvatarRosterPage() {
  const { participant } = await requireParticipant();
  const roster = await listParticipantRoster(participant.eventId);
  return <main className="game-shell"><GamePanel title="Party Roster">
    <p className="text-[var(--muted)]">이번 모임에 계정을 만든 플레이어 {roster.length}명</p>
    <ul className="avatar-roster" aria-label="등록된 플레이어 프로필">
      {roster.map((player) => <li key={player.id}>
        <div className="lobby-grid avatar-roster-summary">
          <PixelAvatar nickname={player.nickname} traits={player.avatar.traits} size={160} />
          <div>
            <p className="pixel-title text-sm text-[var(--pink)]">Player</p>
            <h2 className="mt-2 text-2xl font-bold break-words">{player.nickname}</h2>
            <p className="mt-3 text-[var(--muted)]">이번 모임에 함께하는 플레이어예요.</p>
          </div>
        </div>
        <DeveloperIdentityCard nickname={player.nickname} traits={player.avatar.traits} interactive={false} guideControls="icon" />
      </li>)}
    </ul>
    <Link className="memory-back-link" href="/lobby">로비로 돌아가기</Link>
  </GamePanel></main>;
}
