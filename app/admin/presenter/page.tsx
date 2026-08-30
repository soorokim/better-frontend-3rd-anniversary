import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PresenterController } from '@/components/admin/presenter/PresenterController';
import { requireAdmin } from '@/lib/auth/authorization';

export default async function AdminPresenterPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/admin/login');
  }

  return (
    <main className="game-shell">
      <nav className="mb-5" aria-label="관리자 화면">
        <Link className="memory-back-link mt-0" href="/admin">← 참가자 현황으로</Link>
      </nav>
      <PresenterController />
    </main>
  );
}
