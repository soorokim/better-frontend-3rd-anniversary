'use client';

import { useState, type FormEvent } from 'react';
import { authCookieNames } from '@/lib/auth/cookie-names';

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

type AnswerResponse = {
  content?: string;
  error?: { message?: string };
};

function readCookie(name: string) {
  return document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function MemoryAnswerForm({ initialContent = '' }: { initialContent?: string }) {
  const [draft, setDraft] = useState(initialContent);
  const [lastSaved, setLastSaved] = useState(initialContent);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const remaining = 1000 - draft.length;
  const dirty = draft !== lastSaved;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: 'saving' });
    try {
      const csrfName = authCookieNames(window.location.protocol === 'https:').participantCsrf;
      const csrf = readCookie(csrfName);
      const response = await fetch('/api/answer/current', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}) },
        body: JSON.stringify({ content: draft }),
      });
      const body = await response.json() as AnswerResponse;
      if (!response.ok || typeof body.content !== 'string') {
        setState({ kind: 'error', message: body.error?.message ?? '저장하지 못했어요. 작성 중인 내용은 그대로 남겨 두었습니다.' });
        return;
      }
      setLastSaved(body.content);
      setDraft(body.content);
      setState({ kind: 'success', message: '저장했어요.' });
    } catch {
      setState({ kind: 'error', message: '저장하지 못했어요. 작성 중인 내용은 그대로 남겨 두었습니다.' });
    }
  }

  return <form className="memory-form" onSubmit={save} aria-busy={state.kind === 'saving'}>
    <label className="game-field" htmlFor="memory-answer"><span>나의 3주년 답변</span></label>
    <textarea
      id="memory-answer"
      name="content"
      value={draft}
      onChange={(event) => { setDraft(event.target.value); setState({ kind: 'idle' }); }}
      required
      maxLength={1000}
      rows={9}
      aria-describedby="answer-counter answer-save-state"
    />
    <div className="memory-meta">
      <span id="answer-counter">{remaining.toLocaleString('ko-KR')}자 남음</span>
      <span>{dirty ? '저장하지 않은 변경사항이 있어요.' : lastSaved ? '마지막 성공본과 같아요.' : '아직 저장한 답변이 없어요.'}</span>
    </div>
    <p id="answer-save-state" className={`status ${state.kind}`} role="status" aria-live="polite">
      {state.kind === 'saving' ? '저장 중…' : state.kind === 'idle' ? '' : state.message}
    </p>
    {lastSaved ? <details className="last-saved" open={state.kind === 'error'}><summary>마지막 저장본 확인</summary><p>마지막 저장본: {lastSaved}</p></details> : null}
    <button className="game-button" type="submit" disabled={state.kind === 'saving' || !draft.trim() || draft.length > 1000}>
      {state.kind === 'saving' ? '저장 중…' : '답변 저장'}
    </button>
  </form>;
}
