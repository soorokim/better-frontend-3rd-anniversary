'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { authCookieNames } from '@/lib/auth/cookie-names';
import { AuthStatus, authMessage, type AuthState } from './AuthStatus';

type ApiError = { error?: { code?: string; message?: string; field?: string } };

export function ParticipantAuthForm({ mode }: { mode: 'register' | 'login' }) {
  const [state, setState] = useState<AuthState>({ kind: 'idle' });
  const registering = mode === 'register';
  const [inviteCode, setInviteCode] = useState('');
  const [registrationStep, setRegistrationStep] = useState<'invitation' | 'details'>('invitation');

  async function verifyInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: 'loading' });
    const data = new FormData(event.currentTarget);
    const candidate = String(data.get('inviteCode') ?? '');
    try {
      const response = await fetch('/api/invitations/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteCode: candidate }),
      });
      const body = await response.json() as ApiError;
      if (!response.ok) {
        setState({ kind: 'error', message: authMessage(body.error?.code, body.error?.message) });
        return;
      }
      setInviteCode(candidate);
      setRegistrationStep('details');
      setState({ kind: 'idle' });
    } catch {
      setState({ kind: 'error', message: '연결을 확인하고 초대 코드를 다시 확인해 주세요.' });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: 'loading' });
    const data = new FormData(event.currentTarget);
    const payload = { inviteCode: registering ? inviteCode : data.get('inviteCode'), nickname:data.get('nickname'), pin:data.get('pin'), ...(registering ? { pinConfirmation:data.get('pinConfirmation') } : {}) };
    try {
      const response = await fetch(`/api/participants/${mode}`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload) });
      const body = await response.json() as ApiError;
      if (!response.ok) { setState({ kind:'error', message:authMessage(body.error?.code, body.error?.message) }); return; }
      setState({ kind:'success', message:'입장 완료! 로비로 이동합니다.' });
      window.location.assign(registering ? '/lobby?reveal=1' : '/lobby');
    } catch {
      setState({ kind:'error', message:'연결이 끊겼어요. 작성한 내용은 그대로 두었으니 다시 시도해 주세요.' });
    }
  }

  if (registering && registrationStep === 'invitation') return <form className="auth-form" onSubmit={verifyInvitation} aria-busy={state.kind==='loading'}>
    <p className="text-sm text-[var(--muted)]">먼저 모임 초대 코드를 확인할게요. 확인되기 전에는 닉네임과 PIN을 받지 않습니다.</p>
    <label className="game-field"><span>초대 코드</span><input name="inviteCode" type="password" required minLength={16} autoComplete="off" /></label>
    <AuthStatus state={state} />
    <div className="auth-actions">
      <button className="game-button" type="submit" disabled={state.kind==='loading'}>초대 코드 확인</button>
      <Link href="/login">이미 참여했나요?</Link>
    </div>
  </form>;

  return <form className="auth-form" onSubmit={submit} aria-busy={state.kind==='loading'}>
    {!registering?<label className="game-field"><span>초대 코드</span><input name="inviteCode" type="password" required minLength={16} autoComplete="off" /></label>:null}
    <label className="game-field"><span>닉네임</span><input name="nickname" required maxLength={100} autoComplete="username" /></label>
    <label className="game-field"><span>6자리 PIN</span><input name="pin" type="password" required inputMode="numeric" pattern="[0-9]{6}" autoComplete={registering?'new-password':'current-password'} /></label>
    {registering?<label className="game-field"><span>PIN 확인</span><input name="pinConfirmation" type="password" required inputMode="numeric" pattern="[0-9]{6}" autoComplete="new-password" /></label>:null}
    <AuthStatus state={state} />
    <div className="auth-actions">
      <button className="game-button" type="submit" disabled={state.kind==='loading'}>{registering?'캐릭터 만나기':'로비로 돌아가기'}</button>
      {registering?<button className="text-button" type="button" onClick={() => { setRegistrationStep('invitation'); setState({ kind: 'idle' }); }}>초대 코드 다시 입력</button>:null}
      <Link href={registering?'/login':'/join'}>{registering?'이미 참여했나요?':'처음 오셨나요?'}</Link>
      {!registering?<Link href="/reset-pin">PIN을 잊었나요?</Link>:null}
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
