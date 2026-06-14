import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/40 p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Account suspended</h1>
        <p className="text-sm text-muted-foreground">
          Your firm&apos;s account is currently suspended. Please contact support to
          restore access.
        </p>
        <Button asChild>
          <Link href="/login">Back to sign-in</Link>
        </Button>
      </div>
    </main>
  );
}
