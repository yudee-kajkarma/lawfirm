import { signOut } from '@/auth';
import { Button } from '@/components/ui/button';

export default function SuspendedPage() {
  // A still-valid session cookie would make middleware bounce /login → /dashboard,
  // which then bounces back here (the layout guard sees the suspended tenant).
  // The button signs the user out first so they actually reach /login.
  async function signOutAndGoToLogin() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/40 p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Account suspended</h1>
        <p className="text-sm text-muted-foreground">
          Your firm&apos;s account is currently suspended. Please contact support to
          restore access.
        </p>
        <form action={signOutAndGoToLogin}>
          <Button type="submit">Back to sign-in</Button>
        </form>
      </div>
    </main>
  );
}

