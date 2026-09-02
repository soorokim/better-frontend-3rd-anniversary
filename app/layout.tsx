import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000'),
  title: '프론트엔드 단톡방 3주년',
  description: '더 좋은 프론트엔드를 같이 고민해요! 모두가 함께 만드는 3주년 기념 행사입니다.',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    title: '더 좋은 프론트엔드를 같이 고민해요!',
    description: '프론트엔드 단톡방 3주년 기념 행사 · 모두가 함께 만드는 행사',
    images: [{
      url: '/og/anniversary-og.png',
      width: 1200,
      height: 630,
      alt: '더 좋은 프론트엔드를 같이 고민해요! 프론트엔드 단톡방 3주년 기념 행사',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '더 좋은 프론트엔드를 같이 고민해요!',
    description: '프론트엔드 단톡방 3주년 기념 행사 · 모두가 함께 만드는 행사',
    images: ['/og/anniversary-og.png'],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
