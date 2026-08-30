import Link from 'next/link';
import { GamePanel } from '@/components/game-ui/GamePanel';

export default function StartPage() {
  return <main className="game-shell"><GamePanel>
    <p className="pixel-title text-sm text-[var(--pink)]">Frontend Chat</p>
    <h1 className="pixel-title mt-3 text-3xl sm:text-5xl">3rd Anniversary</h1>
    <p className="mt-6 leading-7 text-[var(--muted)]">수많은 질문과 답변, 배포 실패와 읽씹을 지나 세 번째 체크포인트에 도착했습니다.</p>
    <div className="auth-actions mt-8"><Link className="game-button" href="/join">새로 입장하기</Link><Link className="game-button secondary" href="/login">다시 입장하기</Link></div>
  </GamePanel></main>;
}
