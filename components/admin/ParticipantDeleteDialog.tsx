'use client';

import { useState, type FormEvent } from 'react';
import { authCookieNames } from '@/lib/auth/cookie-names';
import type { AdminParticipant } from './ParticipantList';

function readCookie(name: string) {
  return document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function ParticipantDeleteDialog({
  participant,
  onClose,
  onDeleted,
}: {
  participant: AdminParticipant;
  onClose: () => void;
  onDeleted: (participantId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const csrfName = authCookieNames(location.protocol === 'https:').adminCsrf;
      const csrf = readCookie(csrfName);
      const password = String(data.get('password') ?? '');
      const response = await fetch(`/api/admin/participants/${participant.id}`, {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify(password ? { password } : {}),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } };
        setMessage(body.error?.message ?? '참가자 계정을 삭제하지 못했어요.');
        return;
      }
      onDeleted(participant.id);
    } catch {
      setMessage('연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
    <h2 id="delete-dialog-title" className="pixel-title text-xl text-[var(--danger)]">DELETE PLAYER</h2>
    <p><strong>{participant.nickname}</strong>님의 계정과 답변, 세션, 캐릭터를 삭제합니다. 대화 프로필은 다시 가입할 수 있는 상태로 돌아갑니다.</p>
    <p className="status error">삭제한 참가자 데이터는 관리자 화면에서 복구할 수 없어요.</p>
    <form className="auth-form" onSubmit={submit}>
      <label className="game-field"><span>관리자 비밀번호 (로그인 직후에는 생략 가능)</span><input name="password" type="password" minLength={15} autoComplete="current-password" /></label>
      {message ? <p className="status error" role="alert">{message}</p> : null}
      <div className="dialog-actions">
        <button className="game-button danger" type="submit" disabled={busy}>{busy ? '삭제 중…' : '계정 삭제'}</button>
        <button className="game-button secondary" type="button" onClick={onClose} disabled={busy}>취소</button>
      </div>
    </form>
  </section></div>;
}
