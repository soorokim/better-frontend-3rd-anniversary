import Link from 'next/link';
import { MemoryAnswerForm } from '@/components/forms/MemoryAnswerForm';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { currentAnswer } from '@/lib/answers/answer-service';
import { requireParticipant } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { currentQuestion } from '@/lib/questions/question-service';

export default async function MemoryPage() {
  const { participant } = await requireParticipant();
  let question = null;
  try {
    question = await currentQuestion(participant.eventId);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'question_unavailable') throw error;
  }
  if (!question) {
    return <main className="game-shell"><GamePanel title="Quest Preparing">
      <h1 className="text-2xl font-bold">3주년 질문 준비 중</h1>
      <p className="mt-3 text-[var(--muted)]">질문이 공개되면 이곳에서 답변을 남길 수 있어요.</p>
      <Link className="game-button secondary mt-6" href="/lobby">로비로 돌아가기</Link>
    </GamePanel></main>;
  }

  let initialContent = '';
  try {
    initialContent = (await currentAnswer(participant.id, participant.eventId)).content;
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'answer_not_found') throw error;
  }

  return <main className="game-shell">
    <GamePanel title="3rd Anniversary Memory">
      <p className="pixel-title text-sm text-[var(--pink)]">Today&apos;s Question</p>
      <h1 className="mt-3 text-2xl font-bold leading-relaxed">{question.prompt}</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">천천히 적어도 괜찮아요. 저장한 답변은 나중에 다시 고칠 수 있습니다.</p>
      <MemoryAnswerForm initialContent={initialContent} />
      <Link className="memory-back-link" href="/lobby">로비로 돌아가기</Link>
    </GamePanel>
  </main>;
}
