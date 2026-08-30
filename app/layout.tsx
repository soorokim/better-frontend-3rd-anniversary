import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Frontend Chat v3.0',
  description: '프론트엔드 단톡방 3주년 모임',
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
