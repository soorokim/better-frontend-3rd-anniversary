import Link from 'next/link';
import { QuestionAnswerWorkspace } from '@/components/forms/QuestionAnswerWorkspace';
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
      <p className="mt-3 text-sm text-[var(--muted)]">질문 버튼을 눌러 한 문항씩 작성하고, 각 문항의 저장 버튼으로 따로 저장해 주세요.</p>
      <div className="mt-6"><QuestionAnswerWorkspace
        questions={questions}
        initialAnswers={Object.fromEntries(await Promise.all(questions.map(async (question) => [question.id, (await findOwnedAnswer(participant.id, question.id))?.content ?? ''])))}
      /></div>
      <Link className="memory-back-link" href="/lobby">로비로 돌아가기</Link>
    </GamePanel>
  </main>;
}
