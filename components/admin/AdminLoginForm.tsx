'use client';

import { useState, type FormEvent } from 'react';
import { AuthStatus, type AuthState } from '@/components/forms/AuthStatus';

export function AdminLoginForm() {
  const [state, setState] = useState<AuthState>({ kind: 'idle' });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState({ kind: 'loading' }); const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
      const body = response.status === 204 ? undefined : await response.json() as { error?: { message?: string } };
      if (!response.ok) { setState({ kind: 'error', message: body?.error?.message ?? '관리자 정보를 확인해 주세요.' }); return; }
      setState({ kind: 'success', message: '진행자 화면으로 이동합니다.' }); window.location.assign('/admin');
    } catch { setState({ kind: 'error', message: '연결을 확인하고 다시 시도해 주세요.' }); }
  }
  return <form className="auth-form" onSubmit={submit} aria-busy={state.kind === 'loading'}>
    <label className="game-field"><span>관리자 아이디</span><input name="username" required autoComplete="username" /></label>
    <label className="game-field"><span>관리자 비밀번호</span><input name="password" type="password" required minLength={15} autoComplete="current-password" /></label>
    <AuthStatus state={state} /><button className="game-button" type="submit" disabled={state.kind === 'loading'}>진행자 입장</button>
  </form>;
}
