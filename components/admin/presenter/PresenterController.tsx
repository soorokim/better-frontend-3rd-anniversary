'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import { GamePanel } from '@/components/game-ui/GamePanel';
import { authCookieNames } from '@/lib/auth/cookie-names';
import type { PresentationControllerView } from '@/lib/presentation/presentation-view';
import type { PresentationCommand } from '@/lib/validation/presentation';
import { AnswerQueue } from './AnswerQueue';
import { PresenterSummary } from './PresenterSummary';
import { usePresentationPolling } from './usePresentationPolling';

type ApiError = { error?: { message?: string } };

function readCookie(name: string) {
  return document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function PresenterController() {
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [newAnswerCount, setNewAnswerCount] = useState(0);
  const previousSubmitted = useRef<number | null>(null);
  const { view, status, error, retryNow, markExpired, updateView } = usePresentationPolling();

  useEffect(() => {
    if (!view) return;
    if (previousSubmitted.current !== null && view.summary.submitted > previousSubmitted.current) {
      const addedAnswers = view.summary.submitted - previousSubmitted.current;
      setNewAnswerCount((count) => count + addedAnswers);
    }
    previousSubmitted.current = view.summary.submitted;
  }, [view]);

  async function sendCommand(command: PresentationCommand) {
    setBusy(true);
    setCommandError('');
    try {
      const csrfName = authCookieNames(location.protocol === 'https:').adminCsrf;
      const csrf = readCookie(csrfName);
      const response = await fetch('/api/admin/presentation/commands', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify(command),
      });
      if (response.status === 401) {
        markExpired();
        return;
      }
      const body = await response.json() as PresentationControllerView & ApiError;
      if (!response.ok) throw new Error(body.error?.message ?? '발표 상태를 바꾸지 못했어요.');
      updateView(body);
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : '연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return (
      <GamePanel title="Loading Presenter">
        <p className={`mt-5 ${status === 'expired' ? 'text-[var(--pink)]' : 'text-[var(--muted)]'}`} role={error ? 'alert' : 'status'}>
          {error || '답변과 발표 상태를 불러오는 중이에요...'}
        </p>
        {status === 'expired' ? (
          <button className="game-button mt-5" type="button" onClick={() => location.assign('/admin/login')}>진행자 다시 로그인</button>
        ) : error ? (
          <button className="game-button mt-5" type="button" onClick={retryNow}>지금 다시 연결</button>
        ) : null}
      </GamePanel>
    );
  }

  if (status === 'expired') {
    return (
      <GamePanel title="Session Ended">
        <div className="mt-5 border-l-3 border-[var(--pink)] pl-3" role="alert">
          <p className="status error">진행자 로그인이 만료됐어요. 비공개 답변을 다시 보려면 로그인해 주세요.</p>
          <button className="game-button mt-3" type="button" onClick={() => location.assign('/admin/login')}>진행자 다시 로그인</button>
        </div>
      </GamePanel>
    );
  }

  const { currentSlide } = view;
  const revealLabel = currentSlide?.authorRevealed ? '작성자 공개됨' : '익명으로 공개 중';
  const controlsDisabled = busy;
  const canAdvanceQuestion = view.session.allPresented && !view.progress.completed;

  return (
    <>
      <GamePanel title="Presenter Status">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{view.progress.completed ? '질답 진행 완료' : '답변 발표 진행'}</h1>
            <p className="pixel-title mt-2 text-sm text-[var(--yellow)]">QUESTION {view.progress.currentQuestion} / {view.progress.questionCount}</p>
            <p className="mt-2 text-[var(--muted)]">{view.question.prompt}</p>
          </div>
          <button
            className="game-button"
            type="button"
            disabled={controlsDisabled || view.answers.length === 0 || view.session.allPresented || view.progress.completed}
            onClick={() => void sendCommand({ type: 'select_random' })}
          >
            무작위 답변 공개
          </button>
        </div>
        <div className="presenter-screen-launch">
          <div>
            <strong>프로젝터에는 발표 전용 화면을 띄워 주세요.</strong>
            <p>새 창에서 연 뒤 화면 오른쪽 위의 ‘전체 화면’을 누르면 조작 목록 없이 현재 답변만 보여요.</p>
          </div>
          <Link
            className="game-button"
            href="/admin/presenter/screen"
            target="_blank"
            rel="noopener noreferrer"
          >
            발표 화면 새 창으로 열기
          </Link>
        </div>
        <PresenterSummary summary={view.summary} />
        <div className="mt-4" aria-live="polite">
          {status === 'connected' ? <p className="status success">● 연결됨 · 2초마다 새 상태를 확인해요.</p> : null}
          {status === 'retrying' ? (
            <div className="border-l-3 border-[var(--pink)] pl-3">
              <p className="status error" role="alert">연결이 잠시 끊겼어요. 마지막으로 받은 발표 상태를 유지하고 자동으로 다시 연결할게요.</p>
              <button className="memory-back-link mt-1" type="button" onClick={retryNow}>지금 다시 연결</button>
            </div>
          ) : null}
          {newAnswerCount > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-l-3 border-[var(--mint)] pl-3">
              <p className="text-[var(--mint)]">새 답변 {newAnswerCount}개가 미공개 후보에 들어왔어요.</p>
              <button className="memory-back-link mt-0" type="button" onClick={() => setNewAnswerCount(0)}>확인</button>
            </div>
          ) : null}
          {view.session.allPresented ? (
            <p className="mt-3 border-l-3 border-[var(--yellow)] pl-3 text-[var(--yellow)]">
              {view.progress.completed
                ? '네 질문의 발표가 모두 끝났어요. 참여자 기록 화면에서 전체 답변을 다시 볼 수 있어요.'
                : view.progress.hasNextQuestion
                  ? '이 질문의 답변을 모두 공개했어요. 다음 질문으로 넘어갈 수 있어요.'
                  : '마지막 질문의 답변을 모두 공개했어요. 질답을 마무리할 수 있어요.'}
            </p>
          ) : null}
        </div>
      </GamePanel>

      <div className="mx-auto max-w-4xl px-4">
        <button className="game-button secondary" type="button" disabled={controlsDisabled || !canAdvanceQuestion}
          onClick={() => void sendCommand({ type: 'advance_question' })}>
          {view.progress.hasNextQuestion ? '다음 질문 시작' : '질답 마무리'}
        </button>
      </div>

      <GamePanel title="On Stage" aria-live="polite">
        <div data-testid="presenter-current-slide" className="mt-5 min-h-64 border-4 border-[var(--yellow)] bg-[#111a35] p-5 sm:p-7">
          {currentSlide ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="pixel-title text-sm text-[var(--yellow)]">Memory #{currentSlide.presentationOrder}</span>
                <span className={currentSlide.authorRevealed ? 'text-[var(--mint)]' : 'text-[var(--pink)]'}>{revealLabel}</span>
              </div>
              <p data-testid="presenter-current-answer" className="whitespace-pre-wrap break-words text-lg leading-8 sm:text-xl">{currentSlide.content}</p>
              {currentSlide.authorRevealed ? (
                <div className="flex items-center gap-3 border-t-2 border-[var(--panel-light)] pt-4">
                  <PixelAvatar nickname={currentSlide.author.nickname} traits={currentSlide.author.avatar.traits} size={52} />
                  <strong>{currentSlide.author.nickname}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid min-h-52 place-content-center gap-3 text-center text-[var(--muted)]">
              <p className="pixel-title text-[var(--yellow)]">Ready?</p>
              <p>목록에서 답변을 고르거나 무작위로 하나 공개해 주세요.</p>
            </div>
          )}
        </div>
        {currentSlide ? (
          <button
            className="game-button mt-5"
            type="button"
            disabled={controlsDisabled}
            onClick={() => void sendCommand({ type: 'set_author_visibility', revealed: !currentSlide.authorRevealed })}
          >
            {currentSlide.authorRevealed ? '작성자 숨기기' : '작성자 공개'}
          </button>
        ) : null}
        {commandError ? <p className="status error mt-4" role="alert">{commandError}</p> : null}
      </GamePanel>

      <GamePanel title="Answer Queue">
        <p className="mt-3 text-sm text-[var(--muted)]">이 목록은 관리자에게만 보여요. 원하는 답변을 골라 바로 발표할 수 있어요.
        </p>
        <AnswerQueue
          answers={view.answers}
          busy={controlsDisabled}
          onSelect={(answerId) => void sendCommand({ type: 'select_answer', answerId })}
          onNavigate={(direction) => void sendCommand({ type: 'navigate', direction })}
        />
      </GamePanel>
    </>
  );
}
