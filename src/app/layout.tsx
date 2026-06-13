import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Throughline — coverage between jobs',
  description:
    'Find the health coverage you qualify for between jobs, in minutes not weeks. A self-verifying benefits navigator.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
