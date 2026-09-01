import Link from 'next/link';
import { AvatarReveal } from '@/components/avatar/AvatarReveal';
import { LogoutButton } from '@/components/forms/ParticipantAuthForm';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { requireParticipant } from '@/lib/auth/authorization';
import { lobbyView } from '@/lib/auth/participant-service';
import { findOwnedAnswer } from '@/lib/db/repositories/answers';
import { answerableQuestions } from '@/lib/questions/question-service';

export default async function LobbyPage({ searchParams }: { searchParams: Promise<{ reveal?: string }> }) {
  const { participant } = await requireParticipant();
  const lobby = await lobbyView(participant.id);
  const reveal = (await searchParams).reveal === '1';
  const questions = await answerableQuestions(participant.eventId).catch(() => []);
  const questItems = await Promise.all(questions.map(async (question) => ({
    ...question,
    answer: await findOwnedAnswer(participant.id, question.id),
  })));
  return <main className="game-shell"><GamePanel title="Party Lobby"><AvatarReveal nickname={lobby.nickname} traits={lobby.avatar.traits} reveal={reveal} /></GamePanel><GamePanel title="Quest Log">
    {questItems.length === 0
      ? <p className="text-[var(--muted)]">질문이 공개되면 이곳에 퀘스트가 열립니다.</p>
      : <ol className="quest-log-list" aria-label="3주년 질문 퀘스트">
        {questItems.map((question, index) => {
          const completed = Boolean(question.answer);
          return <li className={`quest-log-item${completed ? ' completed' : ''}`} key={question.id}>
            <div>
              <p className="quest-number">QUEST {String(index + 1).padStart(2, '0')}</p>
              <h2>{question.prompt}</h2>
              <p className="quest-status">{completed ? '작성 완료' : '아직 작성하지 않았어요'}</p>
            </div>
            <Link className="game-button secondary" href={`/memory?questionId=${question.id}`}>
              {completed ? '수정하기' : '작성하기'}
            </Link>
          </li>;
        })}
      </ol>}
    <Link className="memory-back-link mt-4" href="/answers">질답 기록 보기</Link>
    <div className="mt-6"><LogoutButton /></div></GamePanel></main>;
}
