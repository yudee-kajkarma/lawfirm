import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { LoginForm } from './LoginForm';

type Props = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = params.callbackUrl ?? '/dashboard';

  async function loginAction(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const next = String(formData.get('callbackUrl') ?? '/dashboard');
    try {
      await signIn('credentials', { email, password, redirectTo: next });
    } catch (e) {
      if (e instanceof AuthError) {
        redirect(`/login?error=Credentials&callbackUrl=${encodeURIComponent(next)}`);
      }
      throw e;
    }
  }

  return <LoginForm action={loginAction} callbackUrl={callbackUrl} hasError={!!error} />;
}
