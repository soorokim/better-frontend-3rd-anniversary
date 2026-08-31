import Link from 'next/link';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import { requireParticipant } from '@/lib/auth/authorization';
import { participantArchive } from '@/lib/answers/archive-service';
import { AppError } from '@/lib/http/errors';

export default async function AnswersPage() {
  const { participant } = await requireParticipant();
  let archive = null;
  try {
    archive = await participantArchive(participant.eventId);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'archive_unavailable') throw error;
  }
  if (!archive) return <main className="game-shell"><GamePanel title="Archive Locked"><p>질답이 모두 끝나면 여기서 함께 다시 볼 수 있어요.</p><Link className="memory-back-link" href="/lobby">로비로 돌아가기</Link></GamePanel></main>;
  return <main className="game-shell"><GamePanel title="Anniversary Archive"><h1 className="text-2xl font-bold">우리의 3주년 질답</h1><div className="mt-6 grid gap-8">{archive.questions.map((question, index) => <section key={question.id}><h2 className="text-xl font-bold">{index + 1}. {question.prompt}</h2><div className="mt-3 grid gap-3">{question.answers.map((answer, answerIndex) => <article key={answerIndex} className="border-2 border-[var(--panel-light)] p-4"><p className="whitespace-pre-wrap break-words">{answer.content}</p><div className="mt-3 flex items-center gap-2"><PixelAvatar nickname={answer.author.nickname} traits={answer.author.avatar.traits} size={36} /><strong>{answer.author.nickname}</strong></div></article>)}</div></section>)}</div><Link className="memory-back-link" href="/lobby">로비로 돌아가기</Link></GamePanel></main>;
}
