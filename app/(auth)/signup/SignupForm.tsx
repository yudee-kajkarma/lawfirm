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

import type { SignupResult } from './page';

type ErrorKey = 'EmailTaken' | 'Validation' | 'RateLimited' | 'Server' | 'SignIn';

type Props = {
  action: (formData: FormData) => Promise<SignupResult>;
};

const ERROR_MESSAGES: Record<ErrorKey, string> = {
  EmailTaken: 'That email is already in use.',
  Validation: 'Please check your details and try again.',
  RateLimited: 'Too many signup attempts. Try again later.',
  Server: 'Something went wrong. Please try again.',
  SignIn: 'Workspace created, but auto sign-in failed. Try signing in.',
};

export function SignupForm({ action }: Props) {
  const [error, setError] = useState<ErrorKey | null>(null);
  // Plain useState rather than useTransition: window.location.href doesn't
  // unmount React immediately, so the button would briefly re-enable between
  // signIn resolving and the actual navigation. We keep pending true through
  // success and only reset on error.
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setPending(true);
    setError(null);
    const result = await action(fd);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    // Auto sign-in with the just-created credentials, then hard-navigate
    // so the root layout re-executes with the new session cookie.
    // next-auth v5 (beta) is inconsistent about whether bad credentials
    // throw or resolve to { ok: false } — handle both.
    try {
      const signed = await signIn('credentials', {
        email: result.email,
        password: result.password,
        redirect: false,
      });
      if (signed && signed.ok && !signed.error) {
        window.location.href = '/dashboard';
        // Intentionally do not setPending(false) — the page is about to unload.
        return;
      }
      setError('SignIn');
    } catch {
      setError('SignIn');
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
            <CardTitle className="text-xl">Create your workspace</CardTitle>
            <CardDescription>One firm, one workspace. Set up takes 30 seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {ERROR_MESSAGES[error]}
              </motion.div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Firm name</Label>
                <Input id="companyName" name="companyName" required autoFocus placeholder="Smith &amp; Co." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ownerName">Your name</Label>
                <Input id="ownerName" name="ownerName" required placeholder="Alice Smith" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ownerEmail">Email</Label>
                <Input id="ownerEmail" name="ownerEmail" type="email" required autoComplete="email" placeholder="you@firm.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="At least 8 characters"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Creating workspace…' : 'Create workspace'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t bg-muted/30 py-3 text-xs text-muted-foreground">
            Already have an account?&nbsp;
            <Link href="/login" className="underline-offset-4 hover:underline">
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </main>
  );
}
