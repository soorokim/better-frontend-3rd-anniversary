import { ParticipantAuthForm } from '@/components/forms/ParticipantAuthForm';
import { GamePanel } from '@/components/game-ui/GamePanel';

export default function JoinPage() { return <main className="game-shell"><GamePanel title="New Player"><h1 className="mt-3 text-2xl font-bold">내 캐릭터를 만나볼까요?</h1><p className="mt-2 text-[var(--muted)]">PIN은 다음에 돌아올 때 필요해요. 숫자 6자리로 정해 주세요.</p><ParticipantAuthForm mode="register" /></GamePanel></main>; }
