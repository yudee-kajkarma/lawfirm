import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { auth } from '@/auth';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch the session server-side and hand it to SessionProvider as initial
  // state. Without this, the client-side useSession() returns `loading` on
  // first render and anything gated on it (the UserMenu) only appears after
  // /api/auth/session resolves — which on a fresh login looks like the menu
  // is missing until you hit refresh.
  const session = await auth();

  return (
    // suppressHydrationWarning is required because next-themes sets the
    // `class` (dark/light) and ColorThemeProvider sets `data-theme` on this
    // element after first paint — they intentionally diverge from the server
    // render to avoid a flash, and React will otherwise warn.
    <html lang="en" suppressHydrationWarning className={cn('font-sans', geist.variable)}>
      <body className="antialiased">
        <ThemeProviders>
          <SessionProvider session={session}>
            <QueryProvider>{children}</QueryProvider>
          </SessionProvider>
          <Toaster richColors position="top-right" />
        </ThemeProviders>
      </body>
    </html>
  );
}
