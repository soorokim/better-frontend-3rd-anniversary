'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import type { PresentationScreenView } from '@/lib/presentation/presentation-view';

type ScreenStatus = 'loading' | 'connected' | 'retrying' | 'expired';
type ApiError = { error?: { message?: string } };

const POLL_INTERVAL_MS = 2_000;
const MAX_RETRY_DELAY_MS = 5_000;

export function PresentationScreen() {
  const [view, setView] = useState<PresentationScreenView>();
  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const latestRevision = useRef(-1);
  const latestQuestionId = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failureCount = 0;
    let inFlight = false;
    let pollAgain = false;
    let stopped = false;
    const controller = new AbortController();

    function schedule(delay: number) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void poll(), delay);
    }

    function requestImmediatePoll() {
      if (!active || stopped) return;
      if (timer) clearTimeout(timer);
      if (inFlight) {
        pollAgain = true;
        return;
      }
      void poll();
    }

    async function poll() {
      if (!active || stopped) return;
      if (inFlight) {
        pollAgain = true;
        return;
      }
      inFlight = true;
      let nextDelay = POLL_INTERVAL_MS;
      try {
        const response = await fetch('/api/admin/presentation/screen', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (response.status === 401) {
          if (!active) return;
          setStatus('expired');
          setError('진행자 로그인이 만료됐어요. 다시 로그인해 주세요.');
          stopped = true;
          return;
        }

        const body = await response.json() as PresentationScreenView & ApiError;
        if (!response.ok) {
          throw new Error(body.error?.message ?? '발표 화면을 불러오지 못했어요.');
        }
        if (!active) return;

        failureCount = 0;
        if (body.question.id !== latestQuestionId.current
          || body.revision >= latestRevision.current) {
          latestQuestionId.current = body.question.id;
          latestRevision.current = body.revision;
          setView(body);
        }
        setStatus('connected');
        setError('');
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === 'AbortError')) return;

        failureCount += 1;
        nextDelay = Math.min(POLL_INTERVAL_MS * (2 ** (failureCount - 1)), MAX_RETRY_DELAY_MS);
        setStatus('retrying');
        setError(caught instanceof Error ? caught.message : '연결을 확인하고 다시 시도해 주세요.');
      } finally {
        inFlight = false;
        if (active && !stopped) {
          const delay = pollAgain ? 0 : nextDelay;
          pollAgain = false;
          schedule(delay);
        }
      }
    }

    const pollWhenVisible = () => {
      if (document.visibilityState === 'visible') requestImmediatePoll();
    };
    window.addEventListener('online', requestImmediatePoll);
    document.addEventListener('visibilitychange', pollWhenVisible);
    void poll();
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', requestImmediatePoll);
      document.removeEventListener('visibilitychange', pollWhenVisible);
    };
  }, [retryKey]);

  const retryNow = useCallback(() => {
    setStatus('loading');
    setError('');
    setRetryKey((key) => key + 1);
  }, []);

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setError('브라우저 메뉴에서 전체 화면을 켜 주세요.');
    }
  }

  if (status === 'expired') {
    return (
      <main className="presentation-screen presentation-screen-message">
        <section className="presentation-screen-notice" role="alert">
          <p className="pixel-title">Session Ended</p>
          <h1>진행자 로그인이 만료됐어요.</h1>
          <p>{error}</p>
          <a className="game-button" href="/admin/login">진행자 다시 로그인</a>
        </section>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="presentation-screen presentation-screen-message">
        <section className="presentation-screen-notice" aria-live="polite">
          <p className="pixel-title">Loading Stage</p>
          <h1>{error || '발표 화면을 준비하고 있어요...'}</h1>
          {status === 'retrying' ? (
            <button className="game-button" type="button" onClick={retryNow}>지금 다시 연결</button>
          ) : null}
        </section>
      </main>
    );
  }

  const { slide } = view;
  const author = slide.kind === 'answer' && 'author' in slide ? slide.author : undefined;

  return (
    <main className="presentation-screen">
      <header className="presentation-screen-header">
        <div>
          <p className="pixel-title presentation-screen-kicker">3rd Anniversary Memory</p>
          <h1>{view.question.prompt}</h1>
        </div>
        <button className="presentation-fullscreen-button" type="button" onClick={() => void enterFullscreen()}>
          전체 화면
        </button>
      </header>

      <section className="presentation-slide" aria-live="polite" data-testid="presentation-screen-slide">
        {slide.kind === 'waiting' ? (
          <div className="presentation-waiting">
            <p className="pixel-title">Ready?</p>
            <h2>다음 이야기를 기다리고 있어요.</h2>
            <p>진행자가 답변을 고르면 이곳에 나타납니다.</p>
          </div>
        ) : (
          <div className="presentation-answer-layout">
            <div className="presentation-answer-scroll" tabIndex={0} aria-label="현재 발표 답변">
              <p className="presentation-answer" data-testid="presentation-screen-answer">{slide.content}</p>
            </div>
            {author ? (
              <div className="presentation-author" data-testid="presentation-screen-author">
                <PixelAvatar nickname={author.nickname} traits={author.avatar.traits} size={80} />
                <div>
                  <span className="pixel-title">Player</span>
                  <strong>{author.nickname}</strong>
                </div>
              </div>
            ) : (
              <p className="presentation-anonymous pixel-title">Anonymous Memory</p>
            )}
          </div>
        )}
      </section>

      {status === 'retrying' ? (
        <aside className="presentation-connection-warning" role="alert">
          <div>
            <strong>연결이 잠시 끊겼어요.</strong>
            <span>{error} 마지막으로 받은 슬라이드를 유지하고 있습니다.</span>
          </div>
          <button type="button" onClick={retryNow}>지금 다시 연결</button>
        </aside>
      ) : status === 'connected' ? (
        <p className="presentation-connection-ok" aria-label="발표 화면 연결됨">● LIVE</p>
      ) : <p className="presentation-connection-ok" aria-live="polite">● 연결 확인 중</p>}
    </main>
  );
}
