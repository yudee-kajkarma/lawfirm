'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  callbackUrl: string;
  initialError: boolean;
};

export function LoginForm({ callbackUrl, initialError }: Props) {
  const [error, setError] = useState(initialError);
  // Plain useState rather than useTransition: window.location.href doesn't
  // unmount React immediately, so a transition's `pending` would flip back
  // to false (re-enabling the button) between the await resolving and the
  // browser actually navigating. We keep `pending` true through success
  // and only reset it on error.
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');

    setPending(true);
    setError(false);
    // Client-side signIn so we can do a hard navigation on success. A
    // server-action signIn redirect would reuse the root layout's existing
    // SessionProvider (still initialized with session=null from /login), and
    // the UserMenu wouldn't render until the user hit refresh. The full nav
    // forces the root layout to re-execute with the new session cookie.
    //
    // next-auth v5 (beta) is inconsistent about whether bad credentials
    // throw or resolve to { ok: false } — handle both.
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (isSuspendedResult(res)) {
        window.location.href = '/suspended';
        return;
      }
      if (res && res.ok && !res.error) {
        window.location.href = callbackUrl;
        // Intentionally do not setPending(false) — the page is about to unload.
        return;
      }
      setError(true);
    } catch (err) {
      if (isSuspendedError(err)) {
        window.location.href = '/suspended';
        return;
      }
      setError(true);
    }
    setPending(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-secondary/40 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-bold">IP</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">InstaPath</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">CRM</span>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your workspace to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                Invalid email or password.
              </motion.div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t bg-muted/30 py-3 text-xs text-muted-foreground">
            Need an account?&nbsp;
            <Link href="/signup" className="underline-offset-4 hover:underline">
              Create a workspace
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </main>
  );
}

// next-auth v5 (beta) surfaces a custom `CredentialsSignin` subclass's `code`
// inconsistently across versions: sometimes on the resolved result, sometimes
// on a thrown error, sometimes appended to the `url` redirect query string.
// Check every plausible spot.
const SUSPENDED_CODE = 'TenantSuspended';

function isSuspendedResult(res: unknown): boolean {
  if (!res || typeof res !== 'object') return false;
  const r = res as { code?: string; error?: string; url?: string | null };
  if (r.code === SUSPENDED_CODE) return true;
  if (r.error === SUSPENDED_CODE) return true;
  if (typeof r.url === 'string' && r.url.includes(SUSPENDED_CODE)) return true;
  return false;
}

function isSuspendedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code === SUSPENDED_CODE) return true;
  if (typeof e.message === 'string' && e.message.includes(SUSPENDED_CODE)) return true;
  return false;
}
