import { redirect } from 'next/navigation';
import { PresentationScreen } from '@/components/admin/presenter/PresentationScreen';
import { requireAdmin } from '@/lib/auth/authorization';

export default async function AdminPresentationScreenPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/admin/login');
  }

  return <PresentationScreen />;
}
