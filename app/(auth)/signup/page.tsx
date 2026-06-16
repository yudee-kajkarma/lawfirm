import { headers } from 'next/headers';

import { ConflictError } from '@/lib/utils/errors';
import { performTenantSignup } from '@/lib/services/tenantSignup';
import { checkRateLimit } from '@/lib/utils/rateLimit';
import { tenantSignupSchema } from '@/lib/utils/validators/tenant';

import { SignupForm } from './SignupForm';

export type SignupResult =
  | { ok: true; email: string; password: string }
  | { ok: false; error: 'RateLimited' | 'Validation' | 'EmailTaken' | 'Server' };

export default function SignupPage() {
  async function signupAction(formData: FormData): Promise<SignupResult> {
    'use server';

    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headersList.get('x-real-ip') ??
      null;

    if (!checkRateLimit('signup', ip, { capacity: 10, windowMs: 60 * 60_000 })) {
      return { ok: false, error: 'RateLimited' };
    }

    const parsed = tenantSignupSchema.safeParse({
      companyName: formData.get('companyName'),
      ownerName: formData.get('ownerName'),
      ownerEmail: formData.get('ownerEmail'),
      password: formData.get('password'),
    });
    if (!parsed.success) {
      return { ok: false, error: 'Validation' };
    }

    try {
      await performTenantSignup(parsed.data);
    } catch (err) {
      if (err instanceof ConflictError) {
        return { ok: false, error: 'EmailTaken' };
      }
      console.error('[signup] unexpected error', err);
      return { ok: false, error: 'Server' };
    }

    // Return creds so the client can call signIn() and then hard-navigate —
    // a server-action signIn here would reuse the root layout's stale
    // SessionProvider and the dashboard would render without a UserMenu
    // until the user refreshed.
    return { ok: true, email: parsed.data.ownerEmail, password: parsed.data.password };
  }

  return <SignupForm action={signupAction} />;
}
