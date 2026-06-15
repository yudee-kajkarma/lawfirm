# Multi-Tenancy MT-5 (Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

> **Project rule — commits are user-owned:** Every "commit step" stops at a staging-ready summary. **DO NOT run `git add` or `git commit`.** The whole MT-5 phase accumulates as uncommitted changes; the user verifies via the smoke-test gate at the bottom and commits with their own message.

> **Pacing rule:** Execute Tasks 1–4 in one stretch with internal subagent reviews and present one consolidated report at the end. Smoke-test gate is at the bottom.

**Goal:** Close the small gaps that didn't deserve their own phase: route suspended-tenant users to the friendly `/suspended` landing page, fix the noisy `Settings` duplicate-index warning, audit every `.aggregate(` call site, and run a final cross-tenant UAT. After MT-5 the row-level multi-tenancy build (MT-0 through MT-5) is complete.

**Architecture:** No new architecture. Polish only.

**Tech Stack:** Same as prior phases.

**Spec reference:** `docs/superpowers/specs/2026-06-13-multi-tenancy-design.md` — §8 MT-5.

**Out of scope (explicitly deferred):**
- Email confirmation on signup (deferred to the email phase per spec).
- Differentiating "wrong password" from "tenant suspended" at login. By design — the generic message prevents email enumeration; users only see the friendly `/suspended` page when their EXISTING session detects a suspension (defense in depth at the layout and fetch layers).
- CAPTCHA / durable rate limit on signup.
- Operator impersonation.
- Real cross-tenant analytics dashboards.

---

## File map

### Create
- `components/providers/TenantStatusGuard.tsx` — client wrapper around TanStack Query that listens for `TENANT_SUSPENDED` and pushes to `/suspended`.

### Modify
- `app/(dashboard)/layout.tsx` — re-fetch tenant on each render; redirect to `/suspended` if `status !== 'active'`.
- `components/providers/QueryProvider.tsx` — install a global `onError` handler that recognizes `TENANT_SUSPENDED` and emits the redirect.
- `lib/db/tenantScopePlugin.ts` — add a `{ uniqueTenant?: boolean }` option that promotes the auto-added `tenantId` index from non-unique → unique, used for the Settings singleton.
- `lib/models/Settings.ts` — apply `tenantScopePlugin` with `uniqueTenant: true` and drop the now-redundant `SettingsSchema.index({ tenantId: 1 }, { unique: true })`.
- `lib/tenancy/tenantAggregate.ts` — refresh the comment to name the three legitimate raw-aggregate sites (the helper, the smoke test, and the operator user-count route).
- `app/api/operator/tenants/route.ts` — refresh the eslint-disable comment to point at the exhaustive allow-list.

### No-change verifications (Task 3)
- Confirm only 3 raw `.aggregate(` call sites exist (helper, smoke test, operator user-count). Each must be either eslint-disabled with rationale OR allow-listed in `eslint.config.mjs`.

---

## Task 1 — Suspended-tenant friendly path (defense in depth, two layers)

**Why:** Today, when an operator suspends a tenant mid-session, tenant users see a stream of 403 errors on every API call. The dashboard layout doesn't notice. The `/suspended` page exists but is orphaned. This fixes both.

### Files
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/providers/QueryProvider.tsx`
- Create: `components/providers/TenantStatusGuard.tsx`

- [ ] **Step 1: Layout-level guard (server-side, per-render)**

In `app/(dashboard)/layout.tsx`, after the existing `if (!session.user.tenantId) redirect('/login')` guard and BEFORE the `BusinessUnit.find` call, add a tenant status check:

```ts
import { Tenant } from '@/lib/models/Tenant';
// ... existing imports

  // Tenant status kill-switch (server-side). If an operator just suspended
  // this tenant, the next page nav bounces to /suspended rather than
  // letting the user load a dashboard whose API calls will all 403.
  await connectDb();
  const tenantDoc = await Tenant.findById(session.user.tenantId).select('status').lean();
  if (!tenantDoc || tenantDoc.status !== 'active') {
    redirect('/suspended');
  }
```

This is one extra small DB read per page nav. Cheap, and the user sees the friendly page on the very next navigation instead of broken API errors.

- [ ] **Step 2: Client-side TanStack Query global error guard**

Create `components/providers/TenantStatusGuard.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Listens to TanStack Query cache events. Whenever a query or mutation fails
 * with a TENANT_SUSPENDED error code (defined by withAuth.ts), push the user
 * to /suspended. Complements the server-side layout guard so an in-flight
 * page that started loading BEFORE the suspension still routes the user
 * cleanly when the API responds.
 */
export function TenantStatusGuard() {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    const cache = qc.getQueryCache();
    const mutationCache = qc.getMutationCache();

    function check(err: unknown): void {
      if (!(err instanceof Error)) return;
      // The fetcher in our hooks throws Errors with the API's error message;
      // for the suspended case the message includes "TENANT_SUSPENDED".
      if (err.message.includes('TENANT_SUSPENDED') || err.message.includes('suspended')) {
        router.replace('/suspended');
      }
    }

    const unsubQ = cache.subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        check(event.action.error);
      }
    });
    const unsubM = mutationCache.subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        check(event.action.error);
      }
    });

    return () => {
      unsubQ();
      unsubM();
    };
  }, [qc, router]);

  return null;
}
```

Then modify `components/providers/QueryProvider.tsx` — render `<TenantStatusGuard />` once at the top of the provider:

```tsx
import { TenantStatusGuard } from './TenantStatusGuard';

// ... inside the provider's return:
return (
  <QueryClientProvider client={qc}>
    <TenantStatusGuard />
    {children}
    {/* devtools etc. */}
  </QueryClientProvider>
);
```

Important: the guard relies on the existing fetcher throwing a real `Error` whose message contains the API's error string. Spot-check `hooks/useLeads.ts` / `hooks/useUsers.ts` to confirm — if the fetcher just calls `r.json()` without throwing on `!ok`, we need to upgrade it OR the guard never sees the error. If the latter, surface as a concern in your report.

- [ ] **Step 3: Suspended page polish (one tweak)**

In `app/(auth)/suspended/page.tsx`, add a `'use client'` directive at top — but wait, it's a static landing, no client. Leave it alone unless it's broken. (Sanity check: visit `/suspended` directly in dev, page renders.)

- [ ] **Step 4: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS.

- [ ] **Step 5: Move to Task 2** — no commit.

---

## Task 2 — Fix the Settings duplicate-index warning

**Why:** Every test run, every dev server start, every prod boot logs:
```
[MONGOOSE] Warning: mongoose: Duplicate schema index on {"tenantId":1} for model "Settings"
```
It's been ambient noise since MT-1. Root cause: `tenantScopePlugin` adds a non-unique index on `tenantId`, and `Settings.ts` separately adds a unique compound index on `tenantId`. Mongoose treats them as duplicate at the schema level.

Fix: extend the plugin with an option so the field-level index can be promoted to unique when needed. `Settings` is the only model that wants `tenantId` unique (one Settings doc per tenant), but the plugin option is generally useful.

### Files
- Modify: `lib/db/tenantScopePlugin.ts`
- Modify: `lib/models/Settings.ts`

- [ ] **Step 1: Add `uniqueTenant` option to the plugin**

In `lib/db/tenantScopePlugin.ts`, change the plugin signature:

```ts
export type TenantScopePluginOptions = {
  /**
   * If true, the auto-added `tenantId` index is `unique`. Use for tenant-singleton
   * collections (Settings) where exactly one doc per tenant is required.
   * Default: false (non-unique).
   */
  uniqueTenant?: boolean;
};

export function tenantScopePlugin(schema: Schema, options: TenantScopePluginOptions = {}): void {
  schema.add({
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: !options.uniqueTenant ? true : false, // see below
      unique: options.uniqueTenant ?? false,
    },
  });
  // ... rest unchanged
}
```

Note: Mongoose treats `unique: true` as also indexed (a unique index IS an index), so `index: true` becomes redundant when `unique: true` is set — that's why the line is `!options.uniqueTenant`. Alternatively, drop `index: true` entirely and let `unique` do double duty:

```ts
schema.add({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: !options.uniqueTenant,
    unique: options.uniqueTenant === true,
  },
});
```

Either form is correct; pick the simpler one.

The existing schema-tagging, hooks, and `requireTenantId` function stay unchanged.

- [ ] **Step 2: Use it in Settings**

In `lib/models/Settings.ts`:

```ts
// BEFORE
SettingsSchema.plugin(tenantScopePlugin);
// ... ...
SettingsSchema.index({ tenantId: 1 }, { unique: true });

// AFTER
SettingsSchema.plugin(tenantScopePlugin, { uniqueTenant: true });
// ... drop the explicit SettingsSchema.index line entirely
```

- [ ] **Step 3: Update plugin doc comment**

In `lib/db/tenantScopePlugin.ts`, the top-of-file JSDoc should mention the new option:

```
* Pass `{ uniqueTenant: true }` for singleton-per-tenant collections (e.g. Settings)
* so the auto-added tenantId index is unique rather than non-unique.
```

- [ ] **Step 4: Re-seed and verify no warning**

```
npm run seed:reset
```

Watch the output. The "Duplicate schema index on tenantId for model Settings" warning should NO LONGER appear.

If it still appears, the field configuration didn't take effect — typically because Mongoose caches the model. The HMR-safe `mongoose.models.Settings ??` pattern handles dev reloads, but `seed:reset` runs in a fresh process so a clean run is the source of truth.

- [ ] **Step 5: Re-run the CI invariant + signup test**

```
npm run test:multitenancy
npm run test:tenant-signup
```

Both must still PASS — the invariant test verifies Settings still has a tenant-first index (just `unique` now), and the signup test exercises the actual Settings.create.

- [ ] **Step 6: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS.

- [ ] **Step 7: Move to Task 3** — no commit.

---

## Task 3 — Cross-tenant aggregation audit

**Why:** Spec MT-5 calls for "audit all existing `.aggregate(` call sites to confirm they're banned or explicitly opted in." Today's state:

```
lib/tenancy/tenantAggregate.ts                    — the helper itself (eslint allow-listed via `ignores`)
scripts/test-tenant-scope.ts                      — the deliberate leak-proof in tests (allow-listed via `ignores`)
app/api/operator/tenants/route.ts:48              — operator-side user counts, has eslint-disable
```

(plus comment lines in other files — those don't count).

Goal: verify and document this is correct, then refresh the rationale comments so a reader six months from now knows why each exception exists.

### Files
- Modify: `lib/tenancy/tenantAggregate.ts` — refresh the comment naming the three allow-listed sites.
- Modify: `app/api/operator/tenants/route.ts` — refresh the eslint-disable comment to be more specific.
- Audit-only: `eslint.config.mjs` (no code change expected — verify the `ignores` list still matches the helper + smoke test).

- [ ] **Step 1: Re-grep `.aggregate(`**

Run:
```
npm run lint
```
Lint passes ⇒ every raw `.aggregate(` is either inside an `ignores` path OR has an `eslint-disable-next-line no-restricted-syntax` directly above it. This is the source-of-truth check.

If lint passes, the audit is mechanically passing. If not, the surfaced violations are the work — fix them by either migrating to `tenantAggregate` or adding an inline eslint-disable with the right rationale.

- [ ] **Step 2: Refresh the helper's documentation**

In `lib/tenancy/tenantAggregate.ts`, replace the top-of-file JSDoc with:

```ts
/**
 * Wrapper around `Model.aggregate()` that prepends
 *   { $match: { tenantId, deletedAt: null } }
 * to every pipeline. Use this instead of `Model.aggregate(...)` everywhere
 * EXCEPT the three legitimate raw-aggregate sites:
 *
 *   1. This file (the helper IS the wrapped call).
 *   2. `scripts/test-tenant-scope.ts` — uses raw aggregate to prove the leak
 *      that justifies the helper's existence.
 *   3. `app/api/operator/tenants/route.ts` — operator-surface user counts,
 *      cross-tenant by design, per-line eslint-disable with rationale.
 *
 * The eslint rule in `eslint.config.mjs` enforces this. New cross-tenant
 * operator code should add a per-line `// eslint-disable-next-line ...`
 * with `cross-tenant, intentional` in the rationale (greppable).
 */
```

- [ ] **Step 3: Refresh the operator-side eslint-disable comment**

In `app/api/operator/tenants/route.ts`, where the `User.aggregate([...])` lives, update the disable comment to be more specific about WHY:

```ts
// Per-tenant user count across the list page is unavoidable cross-tenant —
// the operator console is the one place this is legitimate. tenantAggregate()
// would scope to a single tenant, which is the wrong primitive here.
// eslint-disable-next-line no-restricted-syntax -- operator console, cross-tenant by design
const userCounts = await User.aggregate([
  { $match: { tenantId: { $in: tenantIds }, deletedAt: null } },
  { $group: { _id: '$tenantId', count: { $sum: 1 } } },
]);
```

- [ ] **Step 4: Verify eslint.config.mjs**

Open `eslint.config.mjs` and confirm the `ignores` list under the `no-restricted-syntax` block contains exactly:
- `lib/tenancy/tenantAggregate.ts`
- `scripts/test-tenant-scope.ts`

If `lib/services/dashboardMetrics.ts` is still there (a relic from MT-0 before MT-1's migration), REMOVE it — dashboardMetrics now uses `tenantAggregate` properly, so the ignore is dead weight.

- [ ] **Step 5: Final lint + typecheck**

```
npm run lint
npm run typecheck
```
Both PASS.

- [ ] **Step 6: Move to Task 4** — no commit.

---

## Task 4 — Final regression sweep + last-mile cleanup

### Files
- No specific files; this is the verification task.

- [ ] **Step 1: Run every test**

```
npm run typecheck
npm run lint
npm run test:multitenancy
npm run test:tenant-scope
npm run test:plugins
npm run test:conversion
npm run test:smart-list
npm run test:tenant-signup
npm run test:operator-flow
npm run test:purge
```

All 10 must PASS, and the Settings duplicate-index warning should NO LONGER appear in any of the test outputs.

- [ ] **Step 2: Stale-marker grep**

```
# Any TODO(MT-*) markers should be gone now
grep -rn "TODO(MT-" app lib hooks components scripts types --include="*.ts" --include="*.tsx"

# Same for any "MT-1 will" or "MT-2 will" markers in comments (those have all landed)
grep -rn "MT-1 will\|MT-2 will\|MT-3 will\|MT-4 will" lib --include="*.ts"
```

Both grep commands should return ZERO hits. If they return hits, those are stale comments to refresh or remove (only if the comment is purely "MT-X will do this" — if it's "MT-X did this", that's fine).

- [ ] **Step 3: Smoke-test boot**

```
npm run dev
```

Visit the home redirect path:
- Logged out, hit `/` → redirected to `/login`. Login page renders cleanly.
- `/signup` page renders.
- `/suspended` page renders.

Don't go further — Task 5's user-side manual gate exercises real flows.

- [ ] **Step 4: Report to user** — end here.

---

## MT-5 smoke-test gate (user runs these)

```powershell
npm run typecheck
npm run lint
npm run test:multitenancy
npm run test:tenant-scope
npm run test:plugins
npm run test:conversion
npm run test:smart-list
npm run test:tenant-signup
npm run test:operator-flow
npm run test:purge
npm run seed:reset           # confirm: NO "Duplicate schema index" warning anywhere
npm run dev
```

## MT-5 manual gate — full cross-tenant UAT

This is the load-bearing manual test of the entire multi-tenancy build (MT-0 → MT-5).

**Pre-flight:**
- Sign out completely in your browser.
- Open three browser contexts: one default, one incognito #1, one incognito #2 (or use three different browsers).

**Round 1 — two-tenant isolation:**

In context #1:
- [ ] Sign up `Acme Legal` with `alice@acme.test`
- [ ] Create a Lead "ACME-LEAD-1" in BU `law`
- [ ] Convert it to a Case, note case number (LAW-2026-0001)
- [ ] Create an Invoice on that case, note invoice number

In context #2:
- [ ] Sign up `Smith & Co.` with `bob@smithco.test`
- [ ] Create a Lead "SMITH-LEAD-1" in BU `immigration`
- [ ] Convert it to a Case, note case number — should ALSO be IMMIGRATION-2026-0001 (per-tenant counter)
- [ ] Open Leads list — **Acme's lead must NOT appear.** Open Cases list — Acme's case must NOT appear.

In context #1:
- [ ] Refresh Leads. Smith's lead must NOT appear.
- [ ] Settings → Audit log — only Acme's actions visible.

**Round 2 — suspended tenant friendly path (the new MT-5 wiring):**

In context #3, sign in as operator (`ops@instapath.test`):
- [ ] Suspend Smith & Co.

Back in context #2 (still signed in as Bob, mid-session):
- [ ] Click any nav link to a list page (Leads, Cases, etc.). **Should redirect to `/suspended`.**
- [ ] `/suspended` shows the friendly "Account suspended" message + "Back to sign-in" button.
- [ ] Try to sign back in as Bob → fails (login refused as before).

In context #3 (operator):
- [ ] Reactivate Smith & Co.

In context #2:
- [ ] Sign in as Bob — works again.

**Round 3 — schedule purge and run it (full pipeline):**

In context #3 (operator):
- [ ] Suspend Smith & Co. again.
- [ ] Schedule purge. Confirm dialog mentions 30-day grace.
- [ ] Fast-forward `purgeScheduledAt` via Mongo shell:
  ```
  db.tenants.updateOne({ slug: 'smith-co' }, { $set: { purgeScheduledAt: new Date(Date.now() - 1000) } })
  ```
- [ ] "Purge now" button appears on tenant detail.
- [ ] Click it, confirm by typing the slug.
- [ ] Land on `/admin/purge-reports` (or detail thereof).
- [ ] Detail view shows **HMAC valid ✓** badge.
- [ ] `/admin/tenants` no longer lists Smith & Co.

In context #2 (was signed in as Bob):
- [ ] Refresh. Bob's session is dead (tenant gone). Redirects to `/login` or `/suspended` (either acceptable — the goal is "no broken state").

**Round 4 — operator audit final check:**
- [ ] `/admin/audit` shows the full sequence: `suspend_tenant`, `reactivate_tenant`, `suspend_tenant`, `schedule_purge`, `purge_now`.

**Round 5 — ambient noise check:**
- [ ] Check the dev-server console output across all of these rounds. The "Duplicate schema index on tenantId for model Settings" warning should be ABSENT.

**Cleanup:** when you're done, `npm run seed:reset` returns the DB to the single default-tenant state.

When everything ticks, MT-5 is done — and that completes the entire multi-tenancy build (MT-0 → MT-5). Commit with a message like:
`feat: MT-5 — polish (suspended-tenant friendly path, Settings index fix, aggregation audit)`

---

## Self-review notes

- **Spec coverage:** §8 MT-5 — suspended-tenant friendly error page ✓ (Task 1), operator console activity counts (already adequate from MT-3), cross-tenant aggregation review ✓ (Task 3). The signup rate-limit polish from §8 is already in place from MT-2.
- **Placeholder scan:** zero `TBD`/`TODO` markers.
- **Type consistency:** `TENANT_SUSPENDED` error code matches what `lib/auth/withAuth.ts` returns. The Tenant `status` enum values referenced are exactly those in `lib/models/Tenant.ts`.
- **Scope:** MT-5 only. Email confirmation, CAPTCHA, KMS, impersonation — all explicitly deferred in the File Map header.
- **Ambiguity:** the client-side guard's substring check on the error message is the load-bearing magic — if the fetcher pattern across hooks isn't consistent (some throw Error, some don't), the guard misses some cases. The plan calls this out and asks the implementer to surface it as a concern if found.
