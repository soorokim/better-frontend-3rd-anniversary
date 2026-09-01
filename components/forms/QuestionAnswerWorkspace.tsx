'use client';

import { useState } from 'react';
import { MemoryAnswerForm } from './MemoryAnswerForm';

type Question = { id: string; prompt: string };

export function QuestionAnswerWorkspace({ questions, initialAnswers, initialQuestionId }: { questions: Question[]; initialAnswers: Record<string, string>; initialQuestionId?: string }) {
  const [selectedId, setSelectedId] = useState(() => (
    questions.some((question) => question.id === initialQuestionId) ? initialQuestionId ?? '' : questions[0]?.id ?? ''
  ));
  const [savedAnswers, setSavedAnswers] = useState(initialAnswers);
  const selectedIndex = questions.findIndex((question) => question.id === selectedId);
  const selected = questions[selectedIndex] ?? questions[0];
  if (!selected) return null;

  return <div className="question-answer-workspace">
    <div className="question-picker" aria-label="작성할 질문 선택">
      {questions.map((question, index) => {
        const answered = Boolean(savedAnswers[question.id]?.trim());
        const active = question.id === selected.id;
        return <button
          key={question.id}
          className={`question-picker-button ${active ? 'active' : ''}`}
          type="button"
          aria-pressed={active}
          onClick={() => setSelectedId(question.id)}
        >
          <span>질문 {index + 1}</span>
          <small>{answered ? '저장됨' : '작성 전'}</small>
        </button>;
      })}
    </div>
    <section className="question-answer-editor" aria-labelledby="selected-question">
      <p className="pixel-title text-sm text-[var(--pink)]">Question {selectedIndex + 1} / {questions.length}</p>
      <h1 id="selected-question" className="mt-3 text-xl font-bold leading-relaxed">{selected.prompt}</h1>
      <MemoryAnswerForm
        key={selected.id}
        questionId={selected.id}
        initialContent={savedAnswers[selected.id] ?? ''}
        onSaved={(content) => setSavedAnswers((current) => ({ ...current, [selected.id]: content }))}
      />
    </section>
  </div>;
}
