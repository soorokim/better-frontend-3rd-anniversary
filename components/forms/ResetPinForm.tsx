'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthStatus, type AuthState } from './AuthStatus';

export function ResetPinForm() {
  const [state, setState] = useState<AuthState>({ kind: 'idle' });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState({ kind: 'loading' });
    const data = new FormData(form);
    const payload = { inviteCode: data.get('inviteCode'), nickname: data.get('nickname'), resetCode: data.get('resetCode'), newPin: data.get('newPin'), newPinConfirmation: data.get('newPinConfirmation') };
    try {
      const response = await fetch('/api/participants/pin-reset/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const body = await response.json() as { error?: { message?: string } }; setState({ kind: 'error', message: body.error?.message ?? '초기화 정보를 확인해 주세요.' }); return; }
      form.reset(); setState({ kind: 'success', message: '새 PIN이 설정됐어요. 새 PIN으로 다시 로그인해 주세요.' });
    } catch { setState({ kind: 'error', message: '연결을 확인하고 다시 시도해 주세요.' }); }
  }
  return <form className="auth-form" onSubmit={submit} aria-busy={state.kind === 'loading'}>
    <label className="game-field"><span>초대 코드</span><input name="inviteCode" type="password" required minLength={4} autoComplete="off" /></label>
    <label className="game-field"><span>닉네임</span><input name="nickname" required maxLength={100} autoComplete="username" /></label>
    <label className="game-field"><span>초기화 코드</span><input name="resetCode" required inputMode="numeric" pattern="[0-9]{8}" autoComplete="one-time-code" /></label>
    <label className="game-field"><span>새 6자리 PIN</span><input name="newPin" type="password" required inputMode="numeric" pattern="[0-9]{6}" autoComplete="new-password" /></label>
    <label className="game-field"><span>새 PIN 확인</span><input name="newPinConfirmation" type="password" required inputMode="numeric" pattern="[0-9]{6}" autoComplete="new-password" /></label>
    <AuthStatus state={state} /><div className="auth-actions"><button className="game-button" type="submit" disabled={state.kind === 'loading'}>새 PIN 설정</button><Link href="/login">로그인으로 돌아가기</Link></div>
  </form>;
}
