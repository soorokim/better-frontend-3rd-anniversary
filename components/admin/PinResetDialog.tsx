'use client';

import { useState, type FormEvent } from 'react';
import { authCookieNames } from '@/lib/auth/cookie-names';
import type { AdminParticipant } from './ParticipantList';

function readCookie(name: string) { return document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1); }

export function PinResetDialog({ participant, onClose }: { participant: AdminParticipant; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [result, setResult] = useState<{ resetCode: string; expiresAt: string }>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const data = new FormData(event.currentTarget);
    try {
      const csrfName = authCookieNames(location.protocol === 'https:').adminCsrf; const csrf = readCookie(csrfName);
      const password = String(data.get('password') ?? '');
      const response = await fetch(`/api/admin/participants/${participant.id}/pin-reset`, { method: 'POST', headers: { 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}) }, body: JSON.stringify(password ? { password } : {}) });
      const body = await response.json() as { resetCode?: string; expiresAt?: string; error?: { message?: string } };
      if (!response.ok || !body.resetCode || !body.expiresAt) { setMessage(body.error?.message ?? '초기화 코드를 만들지 못했어요.'); return; }
      setResult({ resetCode: body.resetCode, expiresAt: body.expiresAt });
    } catch { setMessage('연결을 확인하고 다시 시도해 주세요.'); } finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" role="presentation"><section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
    <h2 id="reset-dialog-title" className="pixel-title text-xl text-[var(--yellow)]">PIN RESET</h2><p><strong>{participant.nickname}</strong>님의 기존 PIN과 열린 세션을 바로 무효화합니다.</p>
    {result ? <div className="reset-result" aria-live="assertive"><p>이 코드는 화면을 닫으면 다시 볼 수 없어요. 참가자에게 바로 전달해 주세요.</p><output data-testid="reset-code" aria-label="8자리 초기화 코드">{result.resetCode}</output><p>{new Date(result.expiresAt).toLocaleTimeString('ko-KR')}까지 유효합니다.</p></div> : <form className="auth-form" onSubmit={submit}><label className="game-field"><span>관리자 비밀번호 (로그인 직후에는 생략 가능)</span><input name="password" type="password" minLength={15} autoComplete="current-password" /></label>{message ? <p className="status error" role="alert">{message}</p> : null}<button className="game-button" type="submit" disabled={busy}>초기화 코드 만들기</button></form>}
    <button className="game-button secondary mt-4" type="button" onClick={onClose}>{result ? '코드 확인 완료' : '취소'}</button>
  </section></div>;
}
