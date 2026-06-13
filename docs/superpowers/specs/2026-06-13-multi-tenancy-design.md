# Multi-Tenancy Design

**Date:** 2026-06-13
**Status:** Approved, ready for implementation planning
**Scope:** Convert InstaPath from single-org / multi-BU to true SaaS multi-tenant, where many independent firms share one app and DB with row-level isolation.

---

## 1. Goals and non-goals

### Goals

- Allow many independent firms ("tenants") to use the same deployment with fully isolated data.
- Preserve the existing Business Unit segregation *within* each tenant.
- Self-serve signup creates a tenant + first admin + default BUs.
- Tenant identification is login-only (no subdomain, no path prefix). The session resolves the tenant.
- An "operator" identity (the platform owner / support team) can manage tenants without ever being a member of one.
- A tenant can be fully deleted with a verifiable sweep that cannot accidentally leave records behind.

### Non-goals (this phase)

- Billing / plan tiers / seat limits. All tenants are unlimited.
- Operator-as-tenant impersonation.
- Per-tenant KMS keys for integration secrets.
- Tenant data export (GDPR-style download-my-data).
- Cross-tenant analytics dashboards for the operator beyond a simple tenant list + per-tenant counts.
- Migrating existing real data. Current DB is dev/seed; safe to wipe.

### Confirmed design decisions

| Decision | Choice |
|---|---|
| Tenant model | True SaaS, many firms, one app |
| Onboarding | Self-serve signup |
| URL strategy | Login-only, no URL marker |
| Cross-tenant users | No — one email = one tenant |
| Existing data | None; safe to wipe |
| Operator role | Yes — platform-operator console |
| Billing | Out of scope this phase |

---

## 2. Isolation strategy: row-level (Approach A)

Every business-facing document carries a `tenantId: ObjectId`. Every query is scoped by `tenantId` first, then by Business Unit. One MongoDB database, one set of collections, shared across all tenants.

**Why row-level over database-per-tenant:**

- Reuses the existing `scopedQuery` discipline rather than rewriting around dynamic Mongoose connections.
- One set of indexes; one schema migration path; one connection pool.
- Adding a tenant is a single insert, not a database provisioning step.
- Operator-side cross-tenant queries (tenants list, per-tenant counts) are trivial; under database-per-tenant they require fan-out.

**The real risk** is a scoping bug that leaks data across tenants. The mitigation is four-layered (Section 4), with a CI meta-test that mechanically prevents the most likely failure mode — forgetting a collection when a new model is added.

---

## 3. Data model

### 3.1 New collection: `Tenant`

```ts
{
  _id: ObjectId,
  name: string,                          // "Smith & Co."
  slug: string,                          // "smith-co" — unique, lowercase, URL-safe
  status: 'active' | 'suspended' | 'pending_purge' | 'purging',
  suspendedAt: Date | null,
  purgeScheduledAt: Date | null,         // suspendedAt + 30d when scheduled
  ownerEmail: string,                    // who signed up; informational
  createdAt: Date,
  updatedAt: Date,
}
```

- `slug` is globally unique (compound is irrelevant — there is no `tenantId` on a tenant document).
- `status` transitions are state-machined in Section 7. `purging` is the in-flight intermediate state during the purge run.
- Soft-delete plugin is **not** applied. Tenants are either present (active/suspended/scheduled) or hard-deleted by the purge pipeline.

### 3.2 `tenantId` on every business collection

Required and indexed on every model in `TENANT_MODELS` (Section 6.1):

```
Lead, Case, Contact, Task, Document, Invoice, CalendarEvent,
Thread, Message, SmartList, Activity, CaseChecklist,
PipelineStage, BusinessUnit, Settings, Counter, User, AuditLog
```

Schema rule:

```ts
tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
```

The `Tenant` model itself does not carry `tenantId`. The new `PlatformOperator` model (Section 6) does not carry `tenantId`.

### 3.3 Index migrations

Every existing composite index whose query pattern includes BU/status filters changes to be **tenant-first**:

| Current | New |
|---|---|
| `{ businessUnit: 1, status: 1 }` | `{ tenantId: 1, businessUnit: 1, status: 1 }` |
| `{ businessUnit: 1, createdAt: -1 }` | `{ tenantId: 1, businessUnit: 1, createdAt: -1 }` |
| `{ businessUnit: 1, 'relatedTo.type': 1, 'relatedTo.id': 1 }` | `{ tenantId: 1, businessUnit: 1, 'relatedTo.type': 1, 'relatedTo.id': 1 }` |

This is not optional. MongoDB cannot efficiently use a composite index whose leading field is not in the query, and every query post-MT-1 includes `tenantId`.

### 3.4 Unique constraints become per-tenant

| Model | Before | After |
|---|---|---|
| `User.email` | global unique | compound unique `{ tenantId: 1, email: 1 }` |
| `BusinessUnit.key` | global unique | compound unique `{ tenantId: 1, key: 1 }` |
| `Counter.key` | global unique | compound unique `{ tenantId: 1, key: 1 }` |
| `Settings` (singleton) | one doc total | one doc per tenant, enforced by unique `{ tenantId: 1 }` |
| `Tenant.slug` | n/a | global unique |

Email is *also* soft-enforced globally unique at signup time (Section 5.4) so login can stay simple (no "which company?" picker).

### 3.5 Settings becomes per-tenant

The `Settings` singleton becomes one document per tenant. `getSettings()` becomes `getSettings(tenantId)`. The signup flow creates the settings document for the new tenant.

The `INTEGRATION_SECRET_KEY` env var remains global. Per-tenant integration secrets are encrypted with the same key — acceptable because isolation is enforced at the row level. Per-tenant KMS rotation is a future concern.

### 3.6 AuditLog gains `tenantId`

Stamped automatically by `auditLogPlugin`, which reads `tenantId` from the request context. The tenant admin's audit log viewer queries via `scopedQuery` and only sees their tenant's entries. Operator audit log is a separate collection (Section 6.4).

---

## 4. Safeguards against cross-tenant leakage

Four independent layers. Each catches what the others miss.

### 4.1 Layer 1 — `tenantScopePlugin` (new Mongoose plugin)

Applied to every model in `TENANT_MODELS`. Adds the `tenantId` schema path. Refuses to run any query that doesn't include `tenantId`:

```ts
function applyFilter(this: any): void {
  if (this.getOptions().__crossTenant) return;
  if (this.getQuery().tenantId === undefined) {
    throw new Error(
      `[tenantScopePlugin] query on ${this.model.modelName} missing tenantId`,
    );
  }
}

schema.pre('find', applyFilter);
schema.pre('findOne', applyFilter);
schema.pre('count', applyFilter);
schema.pre('countDocuments', applyFilter);
schema.pre('updateOne', applyFilter);
schema.pre('updateMany', applyFilter);
schema.pre('deleteOne', applyFilter);
schema.pre('deleteMany', applyFilter);
schema.pre('findOneAndUpdate', applyFilter);
```

Unlike `softDeletePlugin`, this plugin does **not** auto-fill — it refuses. A forgotten `tenantId` is a screaming error in dev, not a silent leak in prod.

Operator code that legitimately needs cross-tenant reads opts in explicitly:

```ts
await Tenant.find({}).setOptions({ __crossTenant: true });  // legitimate cross-tenant
```

`__crossTenant: true` is grep-able. Every occurrence outside `app/api/operator/**` is a code-review red flag.

The plugin tags the schema with a non-enumerable Symbol so the CI invariant test (Section 4.4) can verify it was applied.

### 4.2 Layer 2 — `scopedQuery()` extension

Today returns `{ businessUnit: ... }`. After MT-1 it returns:

```ts
{ tenantId: user.tenantId, businessUnit: ... /* same as today */ }
```

`tenantId` is always first. `scopedQuery` refuses to run if `user.tenantId` is missing (TypeScript enforces this at the type level via `HydratedUser`).

Every existing route already goes through `scopedQuery`. This is a one-line change at the helper; routes get tenant scoping for free.

### 4.3 Layer 3 — `tenantAggregate()` helper + eslint ban on raw `.aggregate(`

Aggregations bypass middleware. This is the most likely place to leak.

```ts
export async function tenantAggregate<T = any>(
  model: Model<any>,
  user: HydratedUser,
  pipeline: PipelineStage[],
): Promise<T[]> {
  return model.aggregate([
    { $match: { tenantId: new Types.ObjectId(user.tenantId), deletedAt: null } },
    ...pipeline,
  ]);
}
```

`$match` with `tenantId` is prepended to every pipeline. Routes call `tenantAggregate(Model, user, pipeline)` instead of `Model.aggregate(pipeline)`.

A custom eslint rule bans raw `.aggregate(` calls in app code:

```js
"no-restricted-syntax": [
  "error",
  {
    selector: "CallExpression[callee.property.name='aggregate']",
    message: "Use tenantAggregate() — raw .aggregate() bypasses tenant scoping.",
  },
],
```

The operator console opts out with an explicit per-line disable comment that includes a cross-tenant rationale.

### 4.4 Layer 4 — CI meta-test (the mechanical guarantee)

`tests/multitenancy.invariants.test.ts` runs in the standard CI job. Asserts:

1. Every model with a `tenantId` schema path is registered in `TENANT_MODELS`.
2. Every model in `TENANT_MODELS` has `tenantScopePlugin` applied (verified via the schema's plugin Symbol).
3. Every model in `TENANT_MODELS` has at least one compound index whose first key is `tenantId`.

A model added next year that forgets any of these fails CI. This is the single guarantee that protects against the real risk: forgetting a collection.

```ts
import mongoose from 'mongoose';
import { TENANT_MODELS, TENANT_SCOPE_PLUGIN_SYMBOL } from '@/lib/tenancy/tenantModels';
import '@/lib/models'; // side-effect: registers every model

test('every model with tenantId is in TENANT_MODELS', () => {
  const registered = new Set(TENANT_MODELS.map(({ model }) => model.modelName));
  const offenders: string[] = [];
  for (const [name, model] of Object.entries(mongoose.models)) {
    if (model.schema.path('tenantId') && !registered.has(name)) {
      offenders.push(name);
    }
  }
  expect(offenders).toEqual([]);
});

test('every model in TENANT_MODELS has tenantScopePlugin applied', () => {
  for (const { model } of TENANT_MODELS) {
    expect((model.schema as any)[TENANT_SCOPE_PLUGIN_SYMBOL]).toBe(true);
  }
});

test('every model in TENANT_MODELS has a tenant-first compound index', () => {
  for (const { model, label } of TENANT_MODELS) {
    const indexes = model.schema.indexes();
    const hasTenantFirst = indexes.some(
      ([fields]) => Object.keys(fields)[0] === 'tenantId',
    );
    expect(hasTenantFirst).toBe(true);
  }
});
```

---

## 5. Authentication and signup

### 5.1 Signup

- **Page:** `/signup` (public).
- **API:** `POST /api/auth/signup`. Body: `{ companyName, ownerName, ownerEmail, password }`. Zod-validated.
- **Behavior:** in a single MongoDB transaction —
  1. Generate a unique slug from `companyName` (lowercase, hyphenate, append numeric suffix if taken).
  2. `Tenant.create({ name, slug, status: 'active', ownerEmail })`.
  3. `User.create({ tenantId, email, name, passwordHash, isAdmin: true, businessUnits: ['immigration', 'law', 'wealth'] })`.
  4. Create three default `BusinessUnit`s: immigration, law, wealth — each tagged with `tenantId`.
  5. `Settings.create({ tenantId, ... defaults })`.
- **Then:** auto sign-in via `signIn('credentials', ...)`. Land on `/dashboard`.
- **Rate-limit:** 10 signups per IP per hour at the edge.

### 5.2 Login (Credentials provider in `auth.ts`)

Two-step lookup:

1. Look up `User.findOne({ email })` — if found, return a `tenant_user` session payload (`kind: 'tenant_user'`, `tenantId`, `isAdmin`, `businessUnits`).
2. Else look up `PlatformOperator.findOne({ email })` — if found, return an `operator` session payload (`kind: 'operator'`, `operatorId`, no `tenantId`).

Login rejected if the tenant's `status !== 'active'` — error message: "Your firm's account is suspended — contact support."

### 5.3 `withAuth` wrapper

`HydratedUser` gains `tenantId: string`. Per request, after hydrating the user from DB, also re-check the tenant document — `Tenant.findById(user.tenantId)`:

- Cache the tenant in `requestContext` so the rest of the request doesn't double-fetch.
- If tenant status is not `'active'`, return 401 with a clear message. (Defends against a JWT issued before suspension.)

The audit-log plugin reads `tenantId` from `requestContext` and stamps it onto every entry automatically.

### 5.4 Global email uniqueness, soft-enforced at signup

The DB constraint on `User.email` is compound `{ tenantId, email }`. But signup (and any "invite user" mutation inside a tenant) performs an extra global check that spans both `User` *and* `PlatformOperator`:

- `User.findOne({ email }).setOptions({ __crossTenant: true })`
- `PlatformOperator.findOne({ email })`

Either match rejects the signup/invite. This keeps both login lookups (Section 5.2's two-step) unambiguous — for any given email, exactly one of the two collections matches at most one row. The operator seed script applies the same dual check before creating a `PlatformOperator`.

This matches the "one email = one tenant" decision and also keeps the tenant/operator namespaces from overlapping.

### 5.5 Middleware (`/middleware.ts`)

No change. Login-gating stays JWT-only. Tenant-status enforcement happens deeper, in `withAuth`, where DB access is cheap and already happening.

---

## 6. Per-tenant resources

### 6.1 `TENANT_MODELS` registry (single source of truth)

```ts
// lib/tenancy/tenantModels.ts
export const TENANT_SCOPE_PLUGIN_SYMBOL = Symbol.for('instapath.tenantScopePlugin');

export const TENANT_MODELS: ReadonlyArray<{ model: Model<any>; label: string }> = [
  { model: Lead,            label: 'leads' },
  { model: Case,            label: 'cases' },
  { model: Contact,         label: 'contacts' },
  { model: Task,            label: 'tasks' },
  { model: Document,        label: 'documents' },     // also has S3 prefix
  { model: Invoice,         label: 'invoices' },
  { model: CalendarEvent,   label: 'calendarEvents' },
  { model: Thread,          label: 'threads' },
  { model: Message,         label: 'messages' },
  { model: SmartList,       label: 'smartLists' },
  { model: Activity,        label: 'activities' },
  { model: CaseChecklist,   label: 'caseChecklists' },
  { model: PipelineStage,   label: 'pipelineStages' },
  { model: BusinessUnit,    label: 'businessUnits' },
  { model: Settings,        label: 'settings' },
  { model: Counter,         label: 'counters' },
  { model: User,            label: 'users' },
  { model: AuditLog,        label: 'auditLogs' },
] as const;
```

`Tenant` is deliberately **not** in the registry — it's deleted last, by hand, after the registry-iterated sweep finishes clean. `PlatformOperator` is also not in the registry — it has no tenant.

### 6.2 BusinessUnit

No conceptual change. Each tenant has its own BUs, each with its own keys. Default seed at signup: immigration, law, wealth (admin can rename / add / remove). The compound unique `(tenantId, key)` replaces the global unique.

### 6.3 Counter / case-number / invoice-number generation

`generateCaseNumber(tenantId, businessUnit, session)` and `generateInvoiceNumber(tenantId, businessUnit, session)`. Per-tenant counters mean Smith & Co's `CASE-2026-001` and Acme's `CASE-2026-001` coexist without ambiguity. This is what firms want.

### 6.4 Operator console — `PlatformOperator` model + `withOperatorAuth`

Distinct from `User` so a type-level boundary prevents an operator from ever being treated as a tenant member.

```ts
PlatformOperator {
  _id, email (global unique), name, passwordHash,
  isActive, lastLoginAt, createdAt, updatedAt
}
```

Seeded manually via `scripts/seed-operator.ts`. No UI to create operators.

**Auth.js Credentials provider** searches `User` first, then `PlatformOperator`.

**JWT shape:**
- Tenant user: `{ kind: 'tenant_user', id, email, name, isAdmin, tenantId, businessUnits }`.
- Operator: `{ kind: 'operator', operatorId, email, name }`. **No `tenantId`.**

`withOperatorAuth()` wrapper is separate from `withAuth()`. It hydrates a `HydratedOperator` (no `tenantId` field — so calling `scopedQuery(operator, ...)` is a TypeScript error). Operator routes live under `/api/operator/**`. Operator UI lives under `/admin/**`.

**Middleware:**
- `/admin/*` requires `kind === 'operator'`.
- `/settings/*` requires `kind === 'tenant_user'` AND `isAdmin === true` (unchanged from today, plus the kind check).
- Operators can only access `/admin/*` — everything else redirects them home.

**MVP operator capabilities:**

| Route | Method | Purpose |
|---|---|---|
| `/api/operator/tenants` | GET | list (cursor pagination); status, name, owner email, user count, signup date |
| `/api/operator/tenants/:id` | GET | detail: BU list, user count, last-7-day activity counts |
| `/api/operator/tenants/:id/suspend` | POST | set `status='suspended'`, `suspendedAt=now` |
| `/api/operator/tenants/:id/reactivate` | POST | back to `status='active'`, valid only if not yet in `pending_purge` past `purgeScheduledAt` |
| `/api/operator/tenants/:id/schedule-purge` | POST | requires `suspended`; sets `status='pending_purge'`, `purgeScheduledAt=suspendedAt + 30d` |
| `/api/operator/tenants/:id/cancel-purge` | POST | valid only during the grace window; back to `suspended` |
| `/api/operator/audit` | GET | operator activity log (cursor paginated) |

**Operator audit log:** separate collection `operatorAuditLogs`. Keeps the per-tenant `auditLogs` clean. Every operator mutation writes here.

**Impersonation: deferred.** Operators have read-only cross-tenant queries via `__crossTenant`. Real impersonation (act as a tenant user) needs a separate design.

---

## 7. Tenant lifecycle: suspend → grace → purge

### 7.1 State machine

```
active ──suspend──▶ suspended ──schedule-purge──▶ pending_purge ──30d & cron──▶ purging ──verified─┐
                       ▲                                │                                          │
                       │                                │                                          ▼
                       └────reactivate / cancel-purge───┘                                       <deleted>
```

- **`active`** — normal operation. Users log in, the app works.
- **`suspended`** — login disabled. Reactivatable. No data is touched.
- **`pending_purge`** — login still disabled. `purgeScheduledAt` is set. Reactivatable via `cancel-purge` until the cron picks it up.
- **`purging`** — in-flight purge. Set atomically (CAS) by the cron to prevent two crons racing.
- After successful purge — tenant document hard-deleted along with all data. There is no "deleted" status; the row is gone.

**Crash recovery.** If the process dies mid-purge, the tenant remains in `purging` with some rows already deleted and some not. The purge is idempotent — the next daily cron re-runs `purgeTenant` for any tenant stuck in `purging` (same eligibility check, treating `purging` the same as `pending_purge` past `purgeScheduledAt`). Re-running the sweep on partially-deleted data produces a clean zero-report.

### 7.2 Purge sequence

Idempotent and resumable. Implemented as `purgeTenant(tenantId)`:

```ts
async function purgeTenant(tenantId: ObjectId): Promise<PurgeReport> {
  // 0. Re-verify eligibility. Status must be 'pending_purge' AND now >= purgeScheduledAt.
  //    Refuse otherwise — defends against a stale cron run.

  // 1. Atomic CAS: status 'pending_purge' → 'purging'. If CAS fails, another worker has it.

  // 2. Initial deletes. Iterate TENANT_MODELS; for each, raw driver deleteMany({ tenantId }).
  //    Raw driver call so middleware doesn't run — we want it gone, not soft-deleted.
  const counts: Record<string, number> = {};
  for (const { model, label } of TENANT_MODELS) {
    const r = await model.collection.deleteMany({ tenantId });
    counts[label] = r.deletedCount ?? 0;
  }

  // 3. Delete S3 prefix `tenants/<tenantId>/`.
  counts['s3:objects'] = await deleteS3Prefix(`tenants/${tenantId}/`);

  // 4. Verification sweep. Iterate TENANT_MODELS AGAIN, count.
  //    Every count must be zero. If any isn't, log loud and leave the tenant doc intact.
  const verification: Record<string, number> = {};
  for (const { model, label } of TENANT_MODELS) {
    verification[label] = await model.collection.countDocuments({ tenantId });
  }
  verification['s3:objects'] = await countS3Prefix(`tenants/${tenantId}/`);
  const nonZero = Object.entries(verification).filter(([, n]) => n > 0);
  if (nonZero.length > 0) throw new PurgeIncomplete(tenantId, verification);

  // 5. Write signed zero-report.
  const report = {
    tenantId, tenantName, tenantSlug,
    purgedAt: new Date(),
    initialDeletes: counts,
    verification,
    hmac: signReport({ tenantId, initialDeletes: counts, verification }),
  };
  await PurgeReport.create(report);

  // 6. Hard-delete the Tenant document.
  await Tenant.deleteOne({ _id: tenantId });
  return report;
}
```

If step 4 reveals leftover rows (most likely cause: a model added recently and forgotten — but the CI invariant test exists precisely to prevent this), the tenant document is left intact and an alert fires. The purge run is idempotent — re-running it will re-sweep and produce the same zero-report.

### 7.3 S3 cleanup

Documents are stored under `tenants/<tenantId>/<entityType>/<documentId>/<filename>`. The key is constructed server-side by the storage helper from `requestContext.tenantId`, never from client input. Deletion: `ListObjectsV2` paged + `DeleteObjects` against `tenants/<tenantId>/`. The list count returned plus the verification re-list is what proves it's gone.

### 7.4 Signed zero-report

`PurgeReport` collection retains the report forever (it's small, one document per purged tenant). The HMAC is computed using `INTEGRATION_SECRET_KEY` over the canonicalized JSON of `{ tenantId, initialDeletes, verification }` — the same key used for integration-secret encryption (already a deployment-required secret). Operator console exposes a `/admin/purge-reports` viewer.

### 7.5 Daily cron

`POST /api/operator/internal/run-purges`, authenticated via a separate `PURGE_CRON_SECRET` env var (HMAC over the request body, so a leaked URL alone is useless). Distinct from `INTEGRATION_SECRET_KEY` because their failure modes are different — leaking the cron secret lets you trigger purges of *eligible* tenants (already 30 days into a scheduled purge), while leaking the integration key compromises stored credentials.

Hit by Vercel cron (or equivalent) once per day. Finds every tenant with `status === 'pending_purge' && purgeScheduledAt <= now`, plus every tenant stuck in `status === 'purging'` (crash recovery, Section 7.1), and runs `purgeTenant` on each sequentially.

Manual "purge now" is available on the operator detail page, eligibility-gated identically.

---

## 8. Phasing

Each phase ends with a smoke test and a manual gate.

**Phase MT-0 — Foundation.** Tenant model, `tenantScopePlugin`, `scopedQuery` extension (gated behind a feature flag), `tenantAggregate` helper, eslint rule, `TENANT_MODELS` skeleton, CI meta-test. No app behavior change yet.
- *Smoke:* `lint + typecheck + npm run test:invariants` passes.
- *Manual gate:* review plugin code and registry.

**Phase MT-1 — Stamp every model.** Add `tenantId` to every model in `TENANT_MODELS`. Migrate indexes tenant-first. Convert unique constraints to compound. Wipe DB. Re-seed with one default tenant; `scopedQuery` resolves `tenantId` from the user, sourced from seed.
- *Smoke:* full app E2E with one tenant; CI meta-test green.
- *Manual gate:* walk the app, nothing visibly broken.

**Phase MT-2 — Signup + login binding.** New `/signup`. `auth.ts` issues JWTs with `tenantId`. `withAuth` reads `tenantId` from session and re-checks tenant status. Suspension kill-switch live.
- *Smoke:* signup creates tenant + admin + default BUs; can log in; suspended tenant cannot log in.
- *Manual gate:* sign up two firms, confirm complete isolation in every list / detail page.

**Phase MT-3 — Operator console.** `PlatformOperator`, seed script, `withOperatorAuth`, `/admin` pages: tenants list, tenant detail, suspend, reactivate, schedule-purge, cancel-purge. Operator audit log.
- *Smoke:* operator logs into `/admin`, suspends a tenant; tenant users can't log in.
- *Manual gate:* operator JWT has no `tenantId`; `/admin/*` blocks tenant users; `/settings/*` and tenant routes block operators.

**Phase MT-4 — Purge pipeline.** `purgeTenant`, verification sweep, S3 cleanup, `PurgeReport`, daily cron route, manual "purge now" button (eligibility-gated).
- *Smoke:* throwaway tenant filled with sample data + S3 upload, suspend, schedule-purge, fast-forward `purgeScheduledAt`, run cron — zero-report; tenant doc gone; S3 prefix gone.
- *Manual gate:* HMAC on zero-report verifies; meta-test still passes.

**Phase MT-5 — Polish.** Self-serve signup rate limit; suspended-tenant friendly error page; operator activity counts; audit of every existing `.aggregate(` to confirm banned or explicitly opted in.
- *Smoke:* lint passes with no eslint-disable for `.aggregate(` outside operator code.
- *Manual gate:* full UAT pass across two tenants + an operator.

**Explicitly deferred:** impersonation, per-tenant KMS, billing/plans, data export, real cross-tenant analytics.

---

## 9. Open questions

None at design time. All raised concerns are resolved in this document. Items the implementation plan will need to decide:

- Exact eslint rule wording and where the rule plugin lives (project-local vs external).
- Cron provider — Vercel Cron if deploying to Vercel, else a small Node scheduler.
- Whether to send a transactional email on signup (out of scope unless wanted; defer to Phase 10 email work).
