import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AvatarReviewGrid } from '@/components/avatar/AvatarReviewGrid';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { requireAdmin } from '@/lib/auth/authorization';

export const dynamic = 'force-dynamic';

export default async function AdminAvatarReviewPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/admin/login');
  }

  return <main className="game-shell">
    <nav className="mb-5" aria-label="관리자 화면">
      <Link className="memory-back-link mt-0" href="/admin">← 참가자 현황으로</Link>
    </nav>
    <GamePanel title="Avatar Quality Check">
      <h1 className="text-2xl font-bold">Open Peeps 아바타 검토</h1>
      <p className="mb-7 mt-2 text-[var(--muted)]">
        네 캐릭터의 seed 일관성, Bold Pop 배경, 아이템 식별성, 선명도와 잘림을 확인해 주세요.
      </p>
      <AvatarReviewGrid mode="pilot" />
    </GamePanel>
  </main>;
}
