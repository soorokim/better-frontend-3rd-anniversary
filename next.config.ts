import type { NextConfig } from 'next';
import { securityHeaders, sensitiveApiHeaders } from './lib/security/headers';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  async headers() {
    const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    return [
      { source: '/:path*', headers: securityHeaders(origin) },
      { source: '/api/:path*', headers: sensitiveApiHeaders },
    ];
  },
};

export default nextConfig;
