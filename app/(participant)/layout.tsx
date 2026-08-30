import { redirect } from 'next/navigation';
import { requireParticipant } from '@/lib/auth/authorization';

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  try { await requireParticipant(); } catch { redirect('/login'); }
  return children;
}
