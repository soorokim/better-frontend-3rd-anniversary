import Link from 'next/link';
import { MemoryAnswerForm } from '@/components/forms/MemoryAnswerForm';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { requireParticipant } from '@/lib/auth/authorization';
import { findOwnedAnswer } from '@/lib/db/repositories/answers';
import { answerableQuestions } from '@/lib/questions/question-service';

export default async function MemoryPage() {
  const { participant } = await requireParticipant();
  const questions = await answerableQuestions(participant.eventId);
  if (!questions.length) {
    return <main className="game-shell"><GamePanel title="Quest Preparing">
      <h1 className="text-2xl font-bold">3주년 질문 준비 중</h1>
      <p className="mt-3 text-[var(--muted)]">질문이 공개되면 이곳에서 답변을 남길 수 있어요.</p>
      <Link className="game-button secondary mt-6" href="/lobby">로비로 돌아가기</Link>
    </GamePanel></main>;
  }

  return <main className="game-shell">
    <GamePanel title="3rd Anniversary Memory">
      <p className="pixel-title text-sm text-[var(--pink)]">Four Questions</p>
      <p className="mt-3 text-sm text-[var(--muted)]">행사 전에 네 질문을 모두 적어 주세요. 행사가 시작되면 수정할 수 없습니다.</p>
      <div className="mt-6 grid gap-8">{await Promise.all(questions.map(async (question, index) => {
        const answer = await findOwnedAnswer(participant.id, question.id);
        return <section key={question.id}><h1 className="text-xl font-bold leading-relaxed">{index + 1}. {question.prompt}</h1><MemoryAnswerForm questionId={question.id} initialContent={answer?.content ?? ''} /></section>;
      }))}</div>
      <Link className="memory-back-link" href="/lobby">로비로 돌아가기</Link>
    </GamePanel>
  </main>;
}
