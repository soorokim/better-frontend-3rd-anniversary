import type { PresentationControllerView } from '@/lib/presentation/presentation-view';

type PresentationSummaryProps = {
  summary: PresentationControllerView['summary'];
};

const summaryItems = [
  { key: 'total', label: '전체', color: 'text-[var(--ink)]' },
  { key: 'submitted', label: '제출', color: 'text-[var(--mint)]' },
  { key: 'notSubmitted', label: '미제출', color: 'text-[var(--pink)]' },
] as const;

export function PresenterSummary({ summary }: PresentationSummaryProps) {
  return (
    <dl className="mt-5 grid grid-cols-3 gap-2" aria-label="답변 제출 현황">
      {summaryItems.map(({ key, label, color }) => (
        <div key={key} className="border-2 border-[var(--panel-light)] bg-[#111a35] px-2 py-4 text-center">
          <dt className="text-xs text-[var(--muted)] sm:text-sm">{label}</dt>
          <dd className={`mt-1 font-mono text-lg font-bold sm:text-xl ${color}`}>
            {label} {summary[key]}명
          </dd>
        </div>
      ))}
    </dl>
  );
}
