import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { ConflictError } from '@/lib/utils/errors';
import { performTenantSignup } from '@/lib/services/tenantSignup';
import { checkRateLimit } from '@/lib/utils/rateLimit';
import { tenantSignupSchema } from '@/lib/utils/validators/tenant';

import { SignupForm } from './SignupForm';

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = params.error;

  async function signupAction(formData: FormData) {
    'use server';

    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headersList.get('x-real-ip') ??
      null;

    // 10 signups per IP per hour. Plenty for honest users; cuts off bots.
    if (!checkRateLimit('signup', ip, { capacity: 10, windowMs: 60 * 60_000 })) {
      redirect('/signup?error=RateLimited');
    }

    const parsed = tenantSignupSchema.safeParse({
      companyName: formData.get('companyName'),
      ownerName: formData.get('ownerName'),
      ownerEmail: formData.get('ownerEmail'),
      password: formData.get('password'),
    });
    if (!parsed.success) {
      redirect('/signup?error=Validation');
    }

    try {
      await performTenantSignup(parsed.data);
    } catch (err) {
      if (err instanceof ConflictError) {
        redirect('/signup?error=EmailTaken');
      }
      console.error('[signup] unexpected error', err);
      redirect('/signup?error=Server');
    }

    try {
      await signIn('credentials', {
        email: parsed.data.ownerEmail,
        password: parsed.data.password,
        redirectTo: '/dashboard',
      });
    } catch (e) {
      if (e instanceof AuthError) {
        redirect('/login?error=Credentials');
      }
      throw e;
    }
  }

  return <SignupForm action={signupAction} error={error ?? null} />;
}
