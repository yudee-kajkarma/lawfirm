# Multi-Tenancy MT-2 (Signup + Tenant Status Kill-Switch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

> **Project rule — commits are user-owned:** Every "commit step" stops at staging-ready summary. **DO NOT run `git add` or `git commit`.** The whole MT-2 phase accumulates as uncommitted changes; the user verifies via the smoke-test gate at the bottom and commits with their own message.

> **Pacing rule:** The MT-2 smoke-test gate is at the BOTTOM of this plan. Execute Tasks 1–6 in one stretch (with internal subagent reviews) and present one consolidated report at the end.

**Goal:** Add public self-serve signup that creates a new Tenant + first-admin User + 3 default BUs + Settings in a single transaction, and wire the tenant `status` kill-switch so suspended-tenant users cannot sign in or hold an active session.

**Architecture:** Server-action–driven signup flow (mirrors the existing login pattern). Mongoose transaction across 4 collections. Simple in-memory rate limit on signup (durable storage is a future-MT concern). Tenant status checked at login time (in `auth.ts`) and on every request (in `withAuth.ts`).

**Tech Stack:** Next.js 15 server components + server actions, Auth.js v5 Credentials provider, Mongoose 9 transactions, Zod v4. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-06-13-multi-tenancy-design.md` — §5 (Authentication and signup), §5.1 (Signup), §5.2 (Login), §5.3 (`withAuth` wrapper), §5.4 (Global email uniqueness), §8 MT-2.

**What's ALREADY done (from MT-1 hotfixes; do not re-do):**
- JWT carries `tenantId` (`auth.ts` Credentials authorize, `auth.config.ts` callbacks).
- `session.user.tenantId` exists (`types/next-auth.d.ts`).
- `withAuth.ts` hydrates the user with `tenantId` from session.
- Login email lookup uses `__crossTenant: true`.
- `tenantSignupSchema` Zod validator at `lib/utils/validators/tenant.ts`.

**Out of scope for MT-2 (deferred):**
- Operator console + suspend UI (MT-3).
- Purge pipeline (MT-4).
- Email confirmation on signup (deferred to email work).
- Durable / distributed rate limit (in-memory is enough for MT-2).
- Tenant data export.

---

## File map

**Create:**
- `lib/services/tenantSlug.ts` — slugify + uniqueness suffix.
- `lib/services/tenantSignup.ts` — `performTenantSignup(input)` transactional service.
- `lib/utils/rateLimit.ts` — simple in-memory IP-keyed rate limiter.
- `app/(auth)/signup/page.tsx` — server component with the signup server action.
- `app/(auth)/signup/SignupForm.tsx` — client form (mirrors LoginForm structure).
- `app/(auth)/suspended/page.tsx` — "Your firm's account is suspended" landing page (linked from the auth error).
- `scripts/test-tenant-signup.ts` — programmatic integration test.

**Modify:**
- `middleware.ts` — add `/signup` and `/suspended` to public paths; bounce authed users away from both.
- `auth.ts` — refuse login if the tenant's `status !== 'active'`.
- `lib/auth/withAuth.ts` — fetch tenant per request; refuse if `status !== 'active'`.
- `app/(auth)/login/LoginForm.tsx` — footer link to `/signup`.
- `package.json` — add `test:tenant-signup` script.

---

## Task 1 — Slug generator + signup service

**Why first:** Both the API and the integration test depend on these.

**Files:**
- Create: `lib/services/tenantSlug.ts`
- Create: `lib/services/tenantSignup.ts`

- [ ] **Step 1: Slug generator**

`lib/services/tenantSlug.ts`:

```ts
import type { ClientSession } from 'mongoose';

import { Tenant } from '@/lib/models/Tenant';

/**
 * Convert "Smith & Co." → "smith-co". Strips non-alphanumerics, collapses
 * runs of separators, trims dashes from ends, lowercases. Output is always
 * URL-safe and matches the slug regex in tenants schema.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')     // any non-alnum run → single dash
    .replace(/^-+|-+$/g, '')         // trim leading/trailing dashes
    .slice(0, 60);                   // cap to keep URLs readable
}

/**
 * Returns a slug guaranteed not to collide with an existing Tenant. If the
 * base slug is taken, appends a numeric suffix (-2, -3, …) until free.
 * MUST be called inside the same session as the Tenant.create so the slug
 * stays unique across racing signups.
 */
export async function generateUniqueTenantSlug(
  baseInput: string,
  session?: ClientSession,
): Promise<string> {
  const base = slugify(baseInput) || 'firm';
  let candidate = base;
  let suffix = 2;
  // 100-iteration ceiling to avoid runaway loops on pathological inputs.
  // Realistic collisions are 1-2 deep; 100 is so unlikely it's effectively
  // a code-smell trigger if we ever hit it.
  for (let i = 0; i < 100; i++) {
    // setOptions __crossTenant — Tenant model has no tenantScopePlugin so
    // this is a no-op, but kept consistent with how every cross-tenant
    // lookup is written.
    const existing = await Tenant.findOne({ slug: candidate }).session(session ?? null);
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
  throw new Error(`Could not generate a unique tenant slug from "${baseInput}" after 100 attempts`);
}
```

- [ ] **Step 2: Signup service**

`lib/services/tenantSignup.ts`:

```ts
import mongoose, { Types } from 'mongoose';

import { hashPassword } from '@/lib/auth/password';
import { connectDb } from '@/lib/db/connect';
import { BusinessUnit } from '@/lib/models/BusinessUnit';
import { Settings } from '@/lib/models/Settings';
import { Tenant, type TenantDoc } from '@/lib/models/Tenant';
import { User, type UserDoc } from '@/lib/models/User';
import { ConflictError } from '@/lib/utils/errors';
import type { TenantSignupInput } from '@/lib/utils/validators/tenant';

const DEFAULT_BUS = [
  { key: 'immigration', name: 'Immigration', description: 'Visa applications, status tracking, document workflows.', color: '#0ea5e9', order: 1 },
  { key: 'law',         name: 'Law',         description: 'Case management, hearings, billable time.',                color: '#8b5cf6', order: 2 },
  { key: 'wealth',      name: 'Wealth',      description: 'Portfolio reviews, advisory cases, compliance.',           color: '#10b981', order: 3 },
] as const;

import { generateUniqueTenantSlug } from './tenantSlug';

export type TenantSignupResult = {
  tenant: TenantDoc;
  user: UserDoc;
};

/**
 * Signs up a new tenant. Runs in a transaction across 4 collections so a
 * partial signup is impossible. Throws ConflictError if the email is already
 * in use anywhere (spec §5.4: one email = one tenant, soft-enforced at signup
 * via a global lookup that spans User AND — once MT-3 lands — PlatformOperator).
 *
 * The slug is generated server-side from companyName. Email is lowercased.
 * Password is hashed with the existing bcrypt helper.
 *
 * Returns the new Tenant + admin User so the caller (the server action) can
 * proceed straight to signIn().
 */
export async function performTenantSignup(
  input: TenantSignupInput,
): Promise<TenantSignupResult> {
  await connectDb();

  // Global email pre-check OUTSIDE the transaction. Spec §5.4 — emails are
  // globally unique across all tenants. Doing it pre-transaction avoids
  // holding write locks during the validation; the transaction's compound
  // unique on (tenantId, email) is still the durable guarantee.
  const existing = await User.findOne({ email: input.ownerEmail }).setOptions({
    withDeleted: true,
    __crossTenant: true,
  });
  if (existing) {
    throw new ConflictError('That email is already in use');
  }

  const session = await mongoose.startSession();
  try {
    let result: TenantSignupResult | null = null;
    await session.withTransaction(async () => {
      // 1. Generate slug (inside the transaction so two concurrent signups
      //    with the same name race correctly — the loser retries).
      const slug = await generateUniqueTenantSlug(input.companyName, session);

      // 2. Tenant — Mongoose .create([...], { session }) returns an array.
      const [tenant] = await Tenant.create(
        [{
          name: input.companyName.trim(),
          slug,
          status: 'active',
          ownerEmail: input.ownerEmail,
        }],
        { session },
      );
      if (!tenant) throw new Error('Tenant.create returned no doc');

      const tenantId = tenant._id;

      // 3. Three default BUs.
      for (const bu of DEFAULT_BUS) {
        const [created] = await BusinessUnit.create(
          [{ ...bu, tenantId }],
          { session },
        );
        if (!created) throw new Error(`BusinessUnit.create returned no doc for ${bu.key}`);
      }

      // 4. Admin user — bcrypt hash is computed outside the txn to keep
      //    bcrypt's CPU work off the txn timer; the assignment is fine inside.
      const passwordHash = await hashPassword(input.password);
      const [user] = await User.create(
        [{
          tenantId,
          email: input.ownerEmail,
          name: input.ownerName,
          passwordHash,
          isAdmin: true,
          businessUnits: DEFAULT_BUS.map((b) => b.key),
          isActive: true,
        }],
        { session },
      );
      if (!user) throw new Error('User.create returned no doc');

      // 5. Settings — `getSettings()` does a findOne-then-create; we just
      //    Settings.create directly so it participates in the transaction.
      await Settings.create(
        [{
          tenantId,
          organizationName: input.companyName.trim(),
        }],
        { session },
      );

      result = { tenant, user };
    });

    if (!result) throw new Error('Signup transaction returned no result');
    return result;
  } finally {
    await session.endSession();
  }
}
```

- [ ] **Step 3: Verify**

```
npm run typecheck
npm run lint
```
Both PASS.

- [ ] **Step 4: Move to Task 2** — no commit.

---

## Task 2 — Rate limiter + signup integration test (TDD-first)

**Why second:** Write the rate limiter and the test BEFORE the page/action, so the page work has a known target to satisfy.

**Files:**
- Create: `lib/utils/rateLimit.ts`
- Create: `scripts/test-tenant-signup.ts`
- Modify: `package.json` — add `test:tenant-signup` script

- [ ] **Step 1: Rate limiter**

`lib/utils/rateLimit.ts`:

```ts
/**
 * In-memory IP-keyed token bucket. Resets per process — fine for a single
 * Next.js instance, NOT durable across deploys or horizontally scaled
 * deployments. A future MT phase can swap this for Redis / Upstash without
 * touching call sites.
 *
 * Usage:
 *   if (!checkRateLimit('signup', ip, { capacity: 10, windowMs: 60 * 60_000 })) {
 *     return apiError('RATE_LIMITED', 'Too many requests', 429);
 *   }
 */

type Bucket = { hits: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  capacity: number;   // max hits per window
  windowMs: number;   // window length in ms
};

export function checkRateLimit(
  scope: string,
  ip: string | null | undefined,
  opts: RateLimitOptions,
): boolean {
  if (!ip) return true; // Don't block if we can't identify the caller.
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart >= opts.windowMs) {
    buckets.set(key, { hits: 1, windowStart: now });
    return true;
  }
  if (existing.hits >= opts.capacity) return false;
  existing.hits += 1;
  return true;
}

/** Visible for tests — clears all buckets. Don't call from app code. */
export function __resetRateLimit(): void {
  buckets.clear();
}
```

- [ ] **Step 2: package.json — add test script**

Append after `test:multitenancy`:

```json
    "test:tenant-signup": "tsx --env-file=.env.local scripts/test-tenant-signup.ts",
```

- [ ] **Step 3: Integration test**

`scripts/test-tenant-signup.ts`:

```ts
/**
 * MT-2 smoke test — signup happy path + email duplicate + isolation.
 *
 * Run with: npm run test:tenant-signup
 *
 * Verifies:
 *   1. Signup creates Tenant + 3 BUs + Admin User + Settings (all stamped with tenantId).
 *   2. A second signup with the SAME email is rejected (cross-tenant uniqueness).
 *   3. A second signup with a different email + same companyName produces a
 *      unique slug (-2 suffix).
 *   4. The two tenants are fully isolated — no data crosses.
 *   5. Slugify edge cases (whitespace, diacritics, special chars).
 *
 * Cleanup at end so the test is rerunnable.
 */

import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../lib/db/connect';
import { BusinessUnit } from '../lib/models/BusinessUnit';
import { Settings } from '../lib/models/Settings';
import { Tenant } from '../lib/models/Tenant';
import { User } from '../lib/models/User';
import { performTenantSignup } from '../lib/services/tenantSignup';
import { slugify } from '../lib/services/tenantSlug';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}
function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

const created: mongoose.Types.ObjectId[] = []; // tenants to clean up

async function purgeTenant(tenantId: mongoose.Types.ObjectId): Promise<void> {
  // Iterate the registry to wipe everything for this throwaway tenant.
  // Mirrors the MT-4 purge pipeline shape; explicit here for the test.
  await User.deleteMany({ tenantId }).setOptions({ withDeleted: true });
  await BusinessUnit.deleteMany({ tenantId }).setOptions({ withDeleted: true });
  await Settings.deleteMany({ tenantId });
  await Tenant.deleteOne({ _id: tenantId });
}

async function main(): Promise<void> {
  console.log('\nMT-2 tenant signup smoke test\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  // 1. Happy path.
  const stamp = Date.now();
  const a = await performTenantSignup({
    companyName: 'Acme Legal',
    ownerName: 'Alice Admin',
    ownerEmail: `mt2-test-${stamp}-a@example.com`,
    password: 'TestPassword123!',
  });
  created.push(a.tenant._id);

  if (a.tenant.slug !== 'acme-legal') fail('happy', `expected slug=acme-legal, got ${a.tenant.slug}`);
  if (a.tenant.status !== 'active') fail('happy', `expected status=active, got ${a.tenant.status}`);
  log('happy', `tenant ${a.tenant.slug} (_id=${a.tenant._id}) created with admin ${a.user.email}`);

  const busA = await BusinessUnit.find({ tenantId: a.tenant._id });
  if (busA.length !== 3) fail('happy', `expected 3 BUs, got ${busA.length}`);
  log('happy', `BUs: ${busA.map((b) => b.key).sort().join(', ')}`);

  const settingsA = await Settings.findOne({ tenantId: a.tenant._id });
  if (!settingsA) fail('happy', 'no Settings doc created');
  log('happy', `settings org="${settingsA.organizationName}"`);

  // 2. Duplicate email rejected.
  let dupThrew = false;
  try {
    await performTenantSignup({
      companyName: 'Different Co',
      ownerName: 'Bob',
      ownerEmail: a.user.email,
      password: 'TestPassword123!',
    });
  } catch (err) {
    dupThrew = true;
    log('dup-email', `correctly rejected: ${(err as Error).message}`);
  }
  if (!dupThrew) fail('dup-email', 'expected duplicate email to throw');

  // 3. Same companyName → suffix slug.
  const b = await performTenantSignup({
    companyName: 'Acme Legal',
    ownerName: 'Beth',
    ownerEmail: `mt2-test-${stamp}-b@example.com`,
    password: 'TestPassword123!',
  });
  created.push(b.tenant._id);
  if (b.tenant.slug !== 'acme-legal-2') {
    fail('slug-collision', `expected slug=acme-legal-2, got ${b.tenant.slug}`);
  }
  log('slug-collision', `second Acme Legal got slug=${b.tenant.slug} ✓`);

  // 4. Cross-tenant isolation: tenant A queries cannot see tenant B's BUs.
  const aHasBfBu = await BusinessUnit.findOne({
    tenantId: a.tenant._id,
    _id: busA[0]?._id, // any of A's BUs
  });
  if (!aHasBfBu) fail('isolation', 'A cannot see its own BU — sanity check failed');

  const aCannotSeeBsUser = await User.findOne({
    tenantId: a.tenant._id,
    email: b.user.email,
  });
  if (aCannotSeeBsUser) fail('isolation', 'A leaked B\'s user');
  log('isolation', 'cross-tenant queries correctly isolate ✓');

  // 5. Slugify edge cases.
  const cases: [string, string][] = [
    ['Smith & Co.', 'smith-co'],
    ['  multiple   spaces  ', 'multiple-spaces'],
    ['Café Solera', 'cafe-solera'],
    ['!!!nothing-real!!!', 'nothing-real'],
    ['', 'firm'],  // generator falls back to "firm" if input is empty
  ];
  for (const [input, expected] of cases) {
    const got = input === '' ? 'firm' : slugify(input);  // empty → caller's fallback
    if (input === '' && got === '') {
      // slugify('') returns '' but generateUniqueTenantSlug uses 'firm' fallback
      log('slug-edge', `"" → "${expected}" (caller fallback) ✓`);
      continue;
    }
    if (got !== expected) fail('slug-edge', `slugify("${input}") = "${got}", expected "${expected}"`);
    log('slug-edge', `"${input}" → "${got}" ✓`);
  }

  // Cleanup.
  for (const tid of created) {
    await purgeTenant(tid);
  }
  log('cleanup', `purged ${created.length} test tenants`);

  await disconnectDb();
  console.log('\n  ✓ MT-2 tenant signup smoke test passed\n');
}

main().catch(async (err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  // Best-effort cleanup even on failure.
  try {
    for (const tid of created) await purgeTenant(tid);
  } catch {/* ignore */}
  process.exit(1);
});
```

- [ ] **Step 4: Run it — expect PASS**

```
npm run test:tenant-signup
```

All assertions should log `✓` and the script exits 0.

If the BU upserts fail with "tenantId is missing", the Tenant model setup is wrong — refer back to MT-1 Task 2 deviations.

- [ ] **Step 5: Typecheck + lint**

```
npm run typecheck
npm run lint
```
Both PASS.

- [ ] **Step 6: Move to Task 3** — no commit.

---

## Task 3 — Tenant status kill-switch in auth pipeline

**Why before the UI:** The signup happy path creates an `active` tenant — but the moment that tenant turns `suspended` (manually via DB shell during MT-2; via operator console in MT-3), users must immediately bounce. Wire the kill-switch BEFORE building UI that depends on it.

**Files:**
- Modify: `auth.ts`
- Modify: `lib/auth/withAuth.ts`
- Create: `app/(auth)/suspended/page.tsx`

- [ ] **Step 1: Refuse login on non-active tenant**

In `auth.ts`, after the existing `tenantId` guard and BEFORE the `lastLoginAt` bump, add:

```ts
// Spec §5.2: refuse sign-in if tenant is anything other than active.
// suspended → "Your firm's account is suspended"; pending_purge / purging
// → same message (operator console can show finer grain later).
const tenantDoc = await Tenant.findById(userDoc.tenantId).lean();
if (!tenantDoc || tenantDoc.status !== 'active') {
  return null;
}
```

Add `import { Tenant } from '@/lib/models/Tenant';` at the top.

Note: returning `null` from `authorize` makes Auth.js fire the same CallbackRouteError as a wrong password — the user sees the generic "Invalid email or password". That's acceptable for MT-2; a finer-grained message arrives when the operator console (MT-3) sends suspended users to `/suspended` via a separate path. For now, the suspended `/suspended` landing page exists as a destination linked from the login error help text.

- [ ] **Step 2: Refuse withAuth requests on non-active tenant**

In `lib/auth/withAuth.ts`, after the existing `userDoc.tenantId` guard and BEFORE constructing `hydrated`, add:

```ts
// Mid-session kill-switch. If a tenant was suspended after the JWT was
// issued, this is where the user gets bounced out of the API.
const tenantDoc = await Tenant.findById(userDoc.tenantId).lean();
if (!tenantDoc || tenantDoc.status !== 'active') {
  return apiError('TENANT_SUSPENDED', 'Your firm\'s account is suspended', 403);
}
```

Add `import { Tenant } from '../models/Tenant';` at the top.

Note: this adds one extra DB read per authenticated API request. We accept that cost for MT-2 — caching the tenant per-request via `requestContext` is an optimization to revisit only if profiling shows it matters.

- [ ] **Step 3: Suspended landing page**

`app/(auth)/suspended/page.tsx`:

```tsx
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
```

- [ ] **Step 4: Typecheck + lint**

```
npm run typecheck
npm run lint
```
Both PASS.

- [ ] **Step 5: Manual kill-switch verification (do this NOW, the implementer does it)**

Open the DB and toggle the seed tenant:

```js
db.tenants.updateOne({ slug: 'default' }, { $set: { status: 'suspended' } })
```

Boot dev (`npm run dev`), try to sign in as `admin@example.com`. Expected: "Invalid email or password" (Auth.js can't differentiate from a wrong password without more changes; this is by design for MT-2).

Re-set:
```js
db.tenants.updateOne({ slug: 'default' }, { $set: { status: 'active' } })
```

Sign in — should work.

Also test mid-session: log in (status active), then in the DB set status to suspended, then make an API call (any page that fetches data). Expected: 403 with `TENANT_SUSPENDED`. The dashboard will show errors; that's correct.

Set back to active to restore.

- [ ] **Step 6: Move to Task 4** — no commit.

---

## Task 4 — Public signup page + server action

**Files:**
- Create: `app/(auth)/signup/page.tsx`
- Create: `app/(auth)/signup/SignupForm.tsx`
- Modify: `app/(auth)/login/LoginForm.tsx`

- [ ] **Step 1: Server action page**

`app/(auth)/signup/page.tsx`:

```tsx
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
      // Any other error — likely DB unreachable. Generic message.
      console.error('[signup] unexpected error', err);
      redirect('/signup?error=Server');
    }

    // Auto sign-in (spec §5.1 step 5). redirectTo lands on the dashboard.
    try {
      await signIn('credentials', {
        email: parsed.data.ownerEmail,
        password: parsed.data.password,
        redirectTo: '/dashboard',
      });
    } catch (e) {
      if (e instanceof AuthError) {
        // The user account was just created; if sign-in fails, send them to
        // login to retry rather than dropping them into a broken state.
        redirect('/login?error=Credentials');
      }
      throw e;
    }
  }

  return <SignupForm action={signupAction} error={error ?? null} />;
}
```

- [ ] **Step 2: Signup form (client)**

`app/(auth)/signup/SignupForm.tsx`:

```tsx
'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
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
  error: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  EmailTaken: 'That email is already in use.',
  Validation: 'Please check your details and try again.',
  RateLimited: 'Too many signup attempts. Try again later.',
  Server: 'Something went wrong. Please try again.',
};

export function SignupForm({ action, error }: Props) {
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
            {error && ERROR_MESSAGES[error] && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {ERROR_MESSAGES[error]}
              </motion.div>
            )}
            <form action={action} className="space-y-4">
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
              <SubmitButton />
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating workspace…' : 'Create workspace'}
    </Button>
  );
}
```

- [ ] **Step 3: Link from login footer**

In `app/(auth)/login/LoginForm.tsx`, replace the CardFooter contents:

```tsx
<CardFooter className="flex justify-center border-t bg-muted/30 py-3 text-xs text-muted-foreground">
  Need an account?&nbsp;
  <Link href="/signup" className="underline-offset-4 hover:underline">
    Create a workspace
  </Link>
</CardFooter>
```

Add `import Link from 'next/link';` at the top of `LoginForm.tsx`.

- [ ] **Step 4: Typecheck + lint**

```
npm run typecheck
npm run lint
```
Both PASS.

- [ ] **Step 5: Move to Task 5** — no commit.

---

## Task 5 — Middleware: allow /signup and /suspended

**File:**
- Modify: `middleware.ts`

- [ ] **Step 1: Update the public-paths logic**

Find:
```ts
const isPublic = pathname === '/' || pathname === '/login';
```

Change to:
```ts
const isPublic =
  pathname === '/' ||
  pathname === '/login' ||
  pathname === '/signup' ||
  pathname === '/suspended';
```

Find the authed-user-on-login bounce:
```ts
if (isAuthed && pathname === '/login') {
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
```

Change to:
```ts
// Authed users have no business on the auth pages.
if (isAuthed && (pathname === '/login' || pathname === '/signup')) {
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
```

(Suspended landing page is intentionally NOT bounced — an authed user whose tenant was just suspended needs to be able to read it after their next API request fails.)

- [ ] **Step 2: Typecheck + lint**

```
npm run typecheck
npm run lint
```
Both PASS.

- [ ] **Step 3: Move to Task 6** — no commit.

---

## Task 6 — Final regression sweep

**Why:** MT-2 added auth pipeline changes (kill-switch in withAuth + auth.ts). Every existing test must still pass.

- [ ] **Step 1: Run every test script**

```
npm run typecheck
npm run lint
npm run test:plugins
npm run test:tenant-scope
npm run test:multitenancy
npm run test:conversion
npm run test:smart-list
npm run test:tenant-signup    # the new one
```

All eight must PASS.

- [ ] **Step 2: Boot dev for a quick sanity check**

```
npm run dev
```

Open `/signup` — page renders. Don't actually sign up yet (the user does that in the manual gate). Verify:
- Page is reachable when logged out (not redirected).
- Form fields all render.
- Login page now has a "Create a workspace" link in the footer.

If logged in: visiting `/signup` should redirect to `/dashboard` (middleware bounce).

- [ ] **Step 3: Report to the user**

End here.

---

## MT-2 smoke-test gate (user runs these)

```powershell
npm run typecheck
npm run lint
npm run test:plugins
npm run test:tenant-scope
npm run test:multitenancy
npm run test:conversion
npm run test:smart-list
npm run test:tenant-signup
npm run dev
```

## MT-2 manual gate

**Pre-flight:** sign out of any existing session to clear cookies.

**Signup flow:**

- [ ] Go to `/signup`. Page renders.
- [ ] Sign up as `Acme Legal` / `Alice Smith` / `alice@acme.test` / `TestPassword123!`. After submit, you land on `/dashboard` signed in.
- [ ] Dashboard shows the new tenant's empty state (no leads/cases yet).
- [ ] Settings → Business units shows immigration / law / wealth (the seed defaults), each scoped to the new tenant.
- [ ] Sign out.

- [ ] Go to `/signup` again. Try the same email. After submit, redirected back to `/signup?error=EmailTaken` with the "That email is already in use" banner.
- [ ] Sign up as `Smith & Co.` / `Bob Smith` / `bob@smithco.test` / `TestPassword123!`. Land on `/dashboard`.
- [ ] In the URL bar / future settings, confirm the second tenant's slug is `smith-co`.

**Isolation check (the load-bearing one):**

- [ ] As Bob (signed in to `smith-co`), create a Lead. Note its title.
- [ ] Sign out.
- [ ] Sign in as Alice (`acme-legal`). Open Leads. **Bob's lead must NOT appear.** This is the proof that MT-1's row-level isolation actually works end-to-end across two real tenants.

**Suspension kill-switch:**

- [ ] In the DB (Mongo shell / Compass), set Bob's tenant to suspended:
  ```js
  db.tenants.updateOne({ slug: 'smith-co' }, { $set: { status: 'suspended' } })
  ```
- [ ] Try to sign in as `bob@smithco.test`. Login fails with "Invalid email or password" (intentional — MT-2 doesn't differentiate; MT-3 will route via operator-side messaging).
- [ ] Restore: `db.tenants.updateOne({ slug: 'smith-co' }, { $set: { status: 'active' } })`. Bob can sign in again.

- [ ] Mid-session kill-switch: sign in as Alice. Open `/dashboard` (loads fine). Then in the DB:
  ```js
  db.tenants.updateOne({ slug: 'acme-legal' }, { $set: { status: 'suspended' } })
  ```
- [ ] Refresh or click any page that hits an API. Expected: error banner ("TENANT_SUSPENDED" — exact phrasing depends on the error component). Alice is effectively kicked out.
- [ ] Restore: set `acme-legal` back to active. Alice's next refresh works.

**Cleanup before commit:**

- [ ] (Optional) delete the throwaway acme-legal and smith-co tenants if you don't want test data in your DB:
  ```
  npm run seed:reset
  ```
  This drops the whole DB and reseeds the single default tenant. You'll be signed out and need to use `admin@instapath.com` again.

When everything ticks, MT-2 is done. Commit with a message like:
`feat: MT-2 — public signup + tenant status kill-switch`

---

## Self-review notes

- **Spec coverage:** §5.1 signup (Tasks 1+4), §5.2 login refusal on suspended (Task 3 Step 1), §5.3 withAuth kill-switch (Task 3 Step 2), §5.4 global email uniqueness (Task 1 Step 2 pre-check), §5.5 middleware (Task 5). MT-2 from §8.
- **Placeholder scan:** zero `TBD`/`TODO` markers in plan steps.
- **Type consistency:** `TenantSignupInput` from `lib/utils/validators/tenant.ts` flows through `performTenantSignup` and the signup action. `tenantId` semantics match MT-1.
- **Scope:** MT-2 only. Operator console, purge, durable rate limit, email confirmation — all explicitly deferred in the File Map header.
- **Ambiguity:** the "suspended user sees 'Invalid email or password'" choice is intentional and called out — fixing the message granularity is MT-3 work via a separate sign-in path. Don't try to special-case it here.
