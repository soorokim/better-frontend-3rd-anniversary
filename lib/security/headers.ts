type SecurityHeader = { key: string; value: string };

const contentSecurityPolicy = (secure: boolean) => [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  ...(secure ? ['upgrade-insecure-requests'] : []),
].join('; ');

/**
 * Browser security policy for document and API responses.
 *
 * The LAN preview intentionally remains usable over HTTP. HSTS and CSP's
 * upgrade directive are therefore enabled only when APP_ORIGIN is HTTPS.
 */
export function securityHeaders(origin: string): SecurityHeader[] {
  const secure = new URL(origin).protocol === 'https:';
  const headers: SecurityHeader[] = [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(secure) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];

  if (secure) {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
  }

  return headers;
}

export const sensitiveApiHeaders: SecurityHeader[] = [
  { key: 'Cache-Control', value: 'no-store, private' },
];
