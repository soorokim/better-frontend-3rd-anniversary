import { ParticipantAuthForm } from '@/components/forms/ParticipantAuthForm';
import { GamePanel } from '@/components/game-ui/GamePanel';

export default function LoginPage() { return <main className="game-shell"><GamePanel title="Continue"><h1 className="mt-3 text-2xl font-bold">다시 로비로 들어가기</h1><p className="mt-2 text-[var(--muted)]">처음 등록한 닉네임과 PIN을 입력해 주세요.</p><ParticipantAuthForm mode="login" /></GamePanel></main>; }
