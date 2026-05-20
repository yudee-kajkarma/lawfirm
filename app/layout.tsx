import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { SessionProvider } from '@/components/providers/SessionProvider';
import { cn } from '@/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'InstaPath CRM',
  description: 'Multi-tenant CRM for Immigration, Law, and Wealth',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
