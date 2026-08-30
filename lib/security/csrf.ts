import { digest, constantTimeEqual } from './crypto';

export function csrfDigest(token: string): string { return digest(token); }
export function verifyCsrf(expectedDigest: string, supplied: string | null): boolean { return Boolean(supplied) && constantTimeEqual(expectedDigest, digest(supplied!)); }
export function verifyOrigin(request: Request, allowedOrigin: string): boolean {
  const origin = request.headers.get('origin');
  return origin === allowedOrigin;
}
