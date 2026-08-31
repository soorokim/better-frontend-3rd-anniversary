import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ParticipantList } from '@/components/admin/ParticipantList';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { requireAdmin } from '@/lib/auth/authorization';
import { adminParticipantList } from '@/lib/auth/admin-service';
import { adminAvatarProfileSummary } from '@/lib/auth/admin-service';
import { AvatarProfileStatus } from '@/components/admin/AvatarProfileStatus';

export default async function AdminPage() {
  let auth: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    auth = await requireAdmin();
  } catch {
    redirect('/admin/login');
  }
  const participants = await adminParticipantList(auth.admin.eventId);
  const avatarProfiles = await adminAvatarProfileSummary(auth.admin.eventId);

  return (
    <main className="game-shell admin-shell">
      <GamePanel title="Party Status">
        <div className="admin-heading">
          <div>
            <h1 className="text-2xl font-bold">참가자 진행 현황</h1>
            <p className="mt-2 text-[var(--muted)]">답변 내용은 보이지 않고 제출 여부만 표시됩니다.</p>
          </div>
          <AdminLogoutButton />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="game-button" href="/admin/presenter">답변 발표 진행하기</Link>
          <Link className="game-button" href="/admin/avatar-review?mode=pilot">아바타 후보 검토하기</Link>
        </div>
      </GamePanel>
      <GamePanel>
        <AvatarProfileStatus summary={avatarProfiles} />
      </GamePanel>
      <GamePanel>
        <ParticipantList participants={participants} />
      </GamePanel>
    </main>
  );
}
