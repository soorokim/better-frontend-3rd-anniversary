import Link from 'next/link';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { GamePanel } from '@/components/game-ui/GamePanel';

export default function AdminLoginPage() { return <main className="game-shell"><GamePanel title="Game Master"><p className="text-[var(--muted)]">참가자 현황과 현장 PIN 복구를 위한 진행자 전용 입구입니다.</p><AdminLoginForm /><Link className="memory-back-link" href="/">참가자 입구로 돌아가기</Link></GamePanel></main>; }
