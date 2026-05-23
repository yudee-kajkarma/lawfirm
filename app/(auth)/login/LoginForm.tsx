'use client';

import { motion } from 'motion/react';
import { useFormStatus } from 'react-dom';

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
  action: (formData: FormData) => Promise<void>;
  callbackUrl: string;
  hasError: boolean;
};

export function LoginForm({ action, callbackUrl, hasError }: Props) {
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
            {hasError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                Invalid email or password.
              </motion.div>
            )}
            <form action={action} className="space-y-4">
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
              <SubmitButton />
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t bg-muted/30 py-3 text-xs text-muted-foreground">
            Need an account? Ask your administrator.
          </CardFooter>
        </Card>
      </motion.div>
    </main>
  );
}

// Server actions don't give us a `pending` flag on the form prop, so we read
// it inside a child component via useFormStatus. Has to be a separate
// component — the hook only returns true while a sibling form is submitting.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}
