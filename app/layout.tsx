import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { QueryProvider } from '@/components/providers/QueryProvider';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { ThemeProviders } from '@/components/providers/ThemeProviders';
import { Toaster } from '@/components/ui/sonner';
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
    // suppressHydrationWarning is required because next-themes sets the
    // `class` (dark/light) and ColorThemeProvider sets `data-theme` on this
    // element after first paint — they intentionally diverge from the server
    // render to avoid a flash, and React will otherwise warn.
    <html lang="en" suppressHydrationWarning className={cn('font-sans', geist.variable)}>
      <body className="antialiased">
        <ThemeProviders>
          <SessionProvider>
            <QueryProvider>{children}</QueryProvider>
          </SessionProvider>
          <Toaster richColors position="top-right" />
        </ThemeProviders>
      </body>
    </html>
  );
}
