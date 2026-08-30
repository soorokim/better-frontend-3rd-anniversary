import { renderPixelAvatar } from '@/lib/avatar/dicebear';
import { traitsFromSearchParams } from '@/lib/avatar/presentation';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const traits = traitsFromSearchParams(new URL(request.url).searchParams);
  const svg = renderPixelAvatar(traits);

  return new Response(svg, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
