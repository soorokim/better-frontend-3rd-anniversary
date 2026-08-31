'use client';

import { PixelAvatar } from '@/components/avatar/PixelAvatar';
import type { PresentationAnswerView } from '@/lib/presentation/presentation-view';

type AnswerQueueProps = {
  answers: PresentationAnswerView[];
  busy: boolean;
  onSelect: (answerId: string) => void;
  onNavigate: (direction: 'previous' | 'next') => void;
};

export function AnswerQueue({ answers, busy, onSelect, onNavigate }: AnswerQueueProps) {
  if (answers.length === 0) {
    return (
      <div className="admin-empty">
        <p className="pixel-title text-[var(--yellow)]">Waiting for Memories</p>
        <p>아직 제출된 답변이 없어요. 참가자가 기록을 남기면 여기에 표시됩니다.</p>
      </div>
    );
  }

  const orderedAnswers = [...answers].sort((left, right) => {
    if (left.status === 'unpresented' && right.status !== 'unpresented') return 1;
    if (left.status !== 'unpresented' && right.status === 'unpresented') return -1;
    if (left.presentationOrder !== null && right.presentationOrder !== null) {
      return left.presentationOrder - right.presentationOrder;
    }
    return new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
  });

  const current = answers.find((answer) => answer.status === 'current');
  const presentedOrders = answers
    .map((answer) => answer.presentationOrder)
    .filter((order): order is number => order !== null);
  const firstOrder = presentedOrders.length > 0 ? Math.min(...presentedOrders) : null;
  const lastOrder = presentedOrders.length > 0 ? Math.max(...presentedOrders) : null;
  const canGoPrevious = current?.presentationOrder !== null
    && current?.presentationOrder !== undefined
    && firstOrder !== null
    && current.presentationOrder > firstOrder;
  const canGoNext = current?.presentationOrder !== null
    && current?.presentationOrder !== undefined
    && lastOrder !== null
    && current.presentationOrder < lastOrder;

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-3" aria-label="발표 순서 이동">
        <button className="game-button secondary" type="button" disabled={busy || !canGoPrevious} onClick={() => onNavigate('previous')}>
          ← 이전 답변
        </button>
        <button className="game-button secondary" type="button" disabled={busy || !canGoNext} onClick={() => onNavigate('next')}>
          다음 답변 →
        </button>
      </div>

      <ol className="mt-5 grid gap-3" aria-label="발표할 답변 후보">
      {orderedAnswers.map((answer, index) => {
        const isCurrent = answer.status === 'current';
        const statusLabel = isCurrent
          ? `${answer.presentationOrder}번째 · 현재 발표 중`
          : answer.status === 'presented'
            ? `${answer.presentationOrder}번째 · 공개 완료`
            : '미공개';

        return (
          <li
            key={answer.id}
            className={`grid gap-3 border-2 p-4 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center ${isCurrent ? 'border-[var(--yellow)] bg-[#34436f]' : 'border-[var(--panel-light)] bg-[#111a35]'}`}
          >
            <PixelAvatar nickname={answer.author.nickname} traits={answer.author.avatar.traits} size={48} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-sm text-[var(--yellow)]">
                  {answer.presentationOrder === null ? `대기 ${String(index + 1).padStart(2, '0')}` : `#${String(answer.presentationOrder).padStart(2, '0')}`}
                </span>
                <strong>{answer.author.nickname}</strong>
                <span className={isCurrent ? 'text-[var(--yellow)]' : answer.status === 'presented' ? 'text-[var(--mint)]' : 'text-[var(--muted)]'}>{statusLabel}</span>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--muted)]">{answer.content}</p>
            </div>
            <button
              className="game-button secondary w-full sm:w-auto"
              type="button"
              disabled={busy}
              onClick={() => onSelect(answer.id)}
              aria-label={`${answer.author.nickname} 답변 공개`}
            >
              {answer.status === 'unpresented' ? '답변 공개' : '다시 공개'}
            </button>
          </li>
        );
      })}
      </ol>
    </>
  );
}
