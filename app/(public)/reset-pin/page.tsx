import { ResetPinForm } from '@/components/forms/ResetPinForm';
import { GamePanel } from '@/components/game-ui/GamePanel';
export default function ResetPinPage() { return <main className="game-shell"><GamePanel title="Recover PIN"><h1 className="text-2xl font-bold">새 PIN 설정</h1><p className="mt-3 text-[var(--muted)]">진행자에게 받은 8자리 초기화 코드를 입력해 주세요. 코드는 10분 동안 한 번만 사용할 수 있습니다.</p><ResetPinForm /></GamePanel></main>; }
