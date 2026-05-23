'use client';

import { Lock } from 'lucide-react';
import { signOut } from 'next-auth/react';

import { Button } from '@/components/ui/button';

type Props = {
  email: string;
};

export function NoAccessLanding({ email }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
          <Lock className="size-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          Your account has no business-unit access
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The business unit(s) you previously had access to are inactive, or your access has been
          revoked. Contact an admin to restore access.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-6"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
