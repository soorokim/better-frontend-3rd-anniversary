'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PresentationControllerView } from '@/lib/presentation/presentation-view';

type ApiError = { error?: { message?: string } };

export type PresentationPollingStatus = 'loading' | 'connected' | 'retrying' | 'expired';

const POLL_INTERVAL_MS = 2_000;
const MAX_RETRY_DELAY_MS = 5_000;

function hasPresentationChanged(
  current: PresentationControllerView | undefined,
  incoming: PresentationControllerView,
) {
  if (!current) return true;
  if (current.question.id !== incoming.question.id) return true;
  if (incoming.session.revision < current.session.revision) return false;
  if (current.session.revision !== incoming.session.revision) return true;
  if (current.summary.submitted !== incoming.summary.submitted) return true;
  if (current.answers.length !== incoming.answers.length) return true;

  return current.answers.some((answer, index) => {
    const next = incoming.answers[index];
    return !next || answer.id !== next.id || answer.updatedAt !== next.updatedAt;
  });
}

export function usePresentationPolling() {
  const [view, setView] = useState<PresentationControllerView>();
  const [status, setStatus] = useState<PresentationPollingStatus>('loading');
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

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
        const response = await fetch('/api/admin/presentation', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (response.status === 401) {
          if (!active) return;
          setStatus('expired');
          setError('진행자 로그인이 만료됐어요. 다시 로그인한 뒤 발표를 이어가 주세요.');
          stopped = true;
          return;
        }

        const body = await response.json() as PresentationControllerView & ApiError;
        if (!response.ok) {
          throw new Error(body.error?.message ?? '발표 상태를 불러오지 못했어요.');
        }
        if (!active) return;

        failureCount = 0;
        setView((current) => hasPresentationChanged(current, body) ? body : current);
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
    setStatus((current) => current === 'expired' ? current : 'loading');
    setError('');
    setRetryKey((key) => key + 1);
  }, []);

  const markExpired = useCallback(() => {
    setStatus('expired');
    setError('진행자 로그인이 만료됐어요. 다시 로그인한 뒤 발표를 이어가 주세요.');
  }, []);

  return {
    view,
    status,
    error,
    retryNow,
    markExpired,
    updateView: setView,
  };
}
