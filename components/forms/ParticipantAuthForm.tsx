'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { authCookieNames } from '@/lib/auth/cookie-names';
import { AuthStatus, authMessage, type AuthState } from './AuthStatus';

type ApiError = { error?: { code?: string; message?: string; field?: string } };

export function ParticipantAuthForm({ mode }: { mode: 'register' | 'login' }) {
  const [state, setState] = useState<AuthState>({ kind: 'idle' });
  const registering = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: 'loading' });
    const data = new FormData(event.currentTarget);
    const payload = { inviteCode:data.get('inviteCode'), nickname:data.get('nickname'), pin:data.get('pin'), ...(registering ? { pinConfirmation:data.get('pinConfirmation') } : {}) };
    try {
      const response = await fetch(`/api/participants/${mode}`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload) });
      const body = await response.json() as ApiError;
      if (!response.ok) { setState({ kind:'error', message:authMessage(body.error?.code, body.error?.message) }); return; }
      setState({ kind:'success', message:'입장 완료! 로비로 이동합니다.' });
      window.location.assign('/lobby');
    } catch {
      setState({ kind:'error', message:'연결이 끊겼어요. 작성한 내용은 그대로 두었으니 다시 시도해 주세요.' });
    }
  }

  return <form className="auth-form" onSubmit={submit} aria-busy={state.kind==='loading'}>
    <label className="game-field"><span>초대 코드</span><input name="inviteCode" type="password" required minLength={16} autoComplete="off" /></label>
    <label className="game-field"><span>닉네임</span><input name="nickname" required maxLength={100} autoComplete="username" /></label>
    <label className="game-field"><span>6자리 PIN</span><input name="pin" type="password" required inputMode="numeric" pattern="[0-9]{6}" autoComplete={registering?'new-password':'current-password'} /></label>
    {registering?<label className="game-field"><span>PIN 확인</span><input name="pinConfirmation" type="password" required inputMode="numeric" pattern="[0-9]{6}" autoComplete="new-password" /></label>:null}
    <AuthStatus state={state} />
    <div className="auth-actions">
      <button className="game-button" type="submit" disabled={state.kind==='loading'}>{registering?'캐릭터 만나기':'로비로 돌아가기'}</button>
      <Link href={registering?'/login':'/join'}>{registering?'이미 참여했나요?':'처음 오셨나요?'}</Link>
    </div>
  </form>;
}

function readCookie(name: string) {
  return document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function LogoutButton() {
  const [state, setState] = useState<AuthState>({ kind:'idle' });
  async function logout() {
    setState({ kind:'loading' });
    try {
      const csrfName = authCookieNames(window.location.protocol === 'https:').participantCsrf;
      const csrf = readCookie(csrfName);
      const response = await fetch('/api/participants/logout', { method:'POST', headers: csrf ? { 'x-csrf-token':decodeURIComponent(csrf) } : {} });
      if (!response.ok) { setState({ kind:'error', message:'로그아웃하지 못했어요. 새로고침 뒤 다시 시도해 주세요.' }); return; }
      window.location.assign('/login');
    } catch { setState({ kind:'error', message:'연결을 확인하고 다시 시도해 주세요.' }); }
  }
  return <div><button className="game-button secondary" type="button" onClick={logout} disabled={state.kind==='loading'}>로그아웃</button><AuthStatus state={state} /></div>;
}
