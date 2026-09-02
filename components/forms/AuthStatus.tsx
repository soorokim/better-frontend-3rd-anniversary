export type AuthState = { kind: 'idle' | 'loading' | 'error' | 'success'; message?: string };

export function AuthStatus({ state }: { state: AuthState }) {
  const message = state.message ?? (state.kind === 'loading' ? '서버와 연결 중입니다…' : '');
  return <p className={`status ${state.kind}`} role="status" aria-live="polite">{message}</p>;
}

export function authMessage(code?: string, fallback?: string) {
  if (code === 'nickname_taken') return '이미 등록된 닉네임이에요. 재입장 화면에서 PIN을 입력해 주세요.';
  if (code === 'invalid_invitation') return '초대 코드를 다시 확인해 주세요.';
  if (code === 'invalid_credentials') return '닉네임 또는 PIN을 다시 확인해 주세요.';
  if (code === 'nickname_ambiguous') return '같은 이름의 플레이어가 있어요. 전체 닉네임을 골라 주세요.';
  if (code === 'rate_limited') return '입력 시도가 많았어요. 잠시 기다린 뒤 다시 시도해 주세요.';
  return fallback || '입장하지 못했어요. 입력을 확인하고 다시 시도해 주세요.';
}
