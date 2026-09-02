import Link from 'next/link';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { requireParticipant } from '@/lib/auth/authorization';
import { listParticipantRoster } from '@/lib/db/repositories/participants';

export default async function AvatarRosterPage() {
  const { participant } = await requireParticipant();
  const roster = await listParticipantRoster(participant.eventId);
  return <main className="game-shell"><GamePanel title="Party Roster">
    <p className="text-[var(--muted)]">이번 모임에 계정을 만든 플레이어 {roster.length}명</p>
    <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="등록된 플레이어 아바타">
      {roster.map((player) => {
        const developerClass = player.avatar.traits.developerAdjective && player.avatar.traits.developerNoun
          ? `${player.avatar.traits.developerAdjective} ${player.avatar.traits.developerNoun}` : null;
        return <li key={player.id} className="border-2 border-[var(--panel-light)] bg-[#111a35] p-3 text-center"><PixelAvatar nickname={player.nickname} traits={player.avatar.traits} size={112} /><strong className="mt-3 block break-words">{player.nickname}</strong>{developerClass ? <p className="mt-1 text-xs text-[var(--pink)]">{developerClass}</p> : null}</li>;
      })}
    </ul>
    <Link className="memory-back-link" href="/lobby">로비로 돌아가기</Link>
  </GamePanel></main>;
}
