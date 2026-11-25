import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WoW GearPath · 한국 리테일 장비 진단',
  description: '장착 장비를 비교하고 솔플과 구렁부터 다음 파밍 경로를 확인하세요.',
};

export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="ko"><body>{children}</body></html>;
}
