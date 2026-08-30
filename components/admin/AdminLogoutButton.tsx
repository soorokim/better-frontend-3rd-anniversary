'use client';

import { useState } from 'react';
import { authCookieNames } from '@/lib/auth/cookie-names';
function readCookie(name: string) { return document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1); }
export function AdminLogoutButton() { const [busy, setBusy] = useState(false); return <button className="game-button secondary" type="button" disabled={busy} onClick={async () => { setBusy(true); const csrf = readCookie(authCookieNames(location.protocol === 'https:').adminCsrf); const response = await fetch('/api/admin/logout', { method: 'POST', headers: csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {} }); if (response.ok) location.assign('/admin/login'); else setBusy(false); }}>진행자 로그아웃</button>; }
