# Multi-Tenancy MT-1 (Stamp Every Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Project rule — commits are user-owned:** Every "commit step" stops at a staging-ready summary. **DO NOT run `git add` or `git commit`.** The whole MT-1 phase accumulates as uncommitted changes; the user verifies via the smoke-test gate at the bottom and commits with their own message.

> **Pacing rule:** The MT-1 smoke-test gate is at the BOTTOM of this plan, after all tasks. Do not surface mid-phase gates. Execute Tasks 1–6 in one stretch (with internal subagent reviews) and present one consolidated report at the end.

**Goal:** Stamp `tenantId` onto every business-facing model, migrate every composite index to be tenant-first, convert global-unique constraints to compound `(tenantId, key)` constraints, populate the `TENANT_MODELS` registry, and rewrite the seed script to create a "default tenant" + tenant-stamped records. After MT-1 the app runs against exactly one tenant and the multi-tenancy invariants (CI meta-test from MT-0) become load-bearing.

**Architecture:** Row-level isolation, approach A from the spec. MT-0 built the safeguards; MT-1 wires them into every existing model. Login still works because `withAuth` re-fetches the user from DB (now including `tenantId`) and pushes it into `requestContext` + `scopedQuery`. The JWT shape does NOT change in MT-1 — that's MT-2's work alongside signup. We rely on the DB lookup to source `tenantId` per request.

**Tech Stack:** Next.js 15, Mongoose 9, TypeScript 5.7 strict, Zod v4. Test scripts are tsx-runnable per the project pattern (`scripts/test-*.ts`). MongoDB Atlas via the existing cached connection.

**Spec reference:** `docs/superpowers/specs/2026-06-13-multi-tenancy-design.md` — §3 (data model), §3.3 (indexes), §3.4 (unique constraints), §3.5 (Settings per-tenant), §3.6 (AuditLog), §4 (safeguards now active), §6.1 (TENANT_MODELS), §8 MT-1.

**MT-0 deliverables in place (do not re-implement):** `lib/tenancy/tenantModels.ts` (empty registry + symbol), `lib/db/tenantScopePlugin.ts`, `lib/tenancy/tenantAggregate.ts`, `lib/models/Tenant.ts`, eslint rule banning raw `.aggregate(`, `scripts/test-multitenancy-invariants.ts`.

---

## File map

**Modify (auth + scoping infrastructure):**
- `lib/auth/withAuth.ts` — add `tenantId` to `HydratedUser`; refuse if user.tenantId missing.
- `lib/auth/requestContext.ts` — add `tenantId` to `RequestUser`.
- `lib/auth/scopedQuery.ts` — extend to include `tenantId` (both admin and non-admin paths).
- `lib/db/auditLogPlugin.ts` — read `tenantId` from doc or context; stamp it on every entry.

**Modify (the 15 business models — apply `tenantScopePlugin`, migrate indexes, fix unique constraints):**
- `lib/models/User.ts` — apply plugin; drop global `email` unique, add compound `(tenantId, email)` unique.
- `lib/models/BusinessUnit.ts` — apply plugin; drop global `key` unique, add compound `(tenantId, key)` unique.
- `lib/models/Counter.ts` — apply plugin; drop global `key` unique, add compound `(tenantId, key)` unique.
- `lib/models/Settings.ts` — apply plugin; add compound `(tenantId)` unique (one settings doc per tenant); update `getSettings()` → `getSettings(tenantId)`.
- `lib/models/Contact.ts` — apply plugin; migrate composite indexes to tenant-first.
- `lib/models/Lead.ts` — same.
- `lib/models/Case.ts` — same.
- `lib/models/CaseChecklist.ts` — same.
- `lib/models/PipelineStage.ts` — same.
- `lib/models/Task.ts` — same.
- `lib/models/Document.ts` — same.
- `lib/models/CalendarEvent.ts` — same.
- `lib/models/SmartList.ts` — same.
- `lib/models/Invoice.ts` — same.
- `lib/models/AuditLog.ts` — apply plugin; migrate composite indexes to tenant-first; add `tenantId` field stamped by the audit-log plugin (which writes to AuditLog).

**Modify (services that pass per-tenant identifiers):**
- `lib/services/caseNumber.ts` — `generateCaseNumber(tenantId, businessUnit, session?)`.
- `lib/services/invoiceNumber.ts` — `generateInvoiceNumber(tenantId, businessUnit, session?)`.
- `lib/services/leadConversion.ts` — pass `lead.tenantId` into `generateCaseNumber` and `Case.create`.
- `app/api/cases/route.ts` — pass `user.tenantId` into `generateCaseNumber` and `Case.create`.
- `app/api/invoices/route.ts` — pass `user.tenantId` into `generateInvoiceNumber` and `Invoice.create`.

**Modify (the registry):**
- `lib/tenancy/tenantModels.ts` — populate with all 15 models.

**Modify (the seed):**
- `scripts/seed.ts` — drop entire DB on `--reset`; create a default `Tenant` first; stamp `tenantId` on every seeded record.

**Out of scope for MT-1 (deferred):**
- Signup / public registration (MT-2).
- JWT containing `tenantId` (MT-2 will fold it in alongside the kind-of-user discriminator).
- `withAuth` checking tenant `status === 'active'` (MT-2, when statuses can change via UI).
- Operator console (MT-3).
- Purge pipeline (MT-4).
- Migrating the 6 `TODO(MT-1)` aggregate sites in `dashboardMetrics.ts` — those are switched to `tenantAggregate` in this phase as part of Task 3 (yes, MT-1 owns this, not MT-3).

---

## Task 1 — Extend the auth + scoping layer to carry tenantId

**Why first:** Every model change in Task 2 immediately starts requiring `tenantId` on queries (via `tenantScopePlugin`). The carriers must exist first or the codebase won't compile through the migration.

**Files:**
- Modify: `lib/auth/requestContext.ts`
- Modify: `lib/auth/withAuth.ts`
- Modify: `lib/auth/scopedQuery.ts`
- Modify: `lib/db/auditLogPlugin.ts`

- [ ] **Step 1: Extend `RequestUser` and `RequestContext`**

In `lib/auth/requestContext.ts`, change the `RequestUser` type to:

```ts
export type RequestUser = {
  _id: string;
  email: string;
  tenantId: string;
  isAdmin: boolean;
  businessUnits: string[];
};
```

No other changes in this file.

- [ ] **Step 2: Extend `HydratedUser` and hydrate `tenantId` in `withAuth`**

In `lib/auth/withAuth.ts`:

a) Extend the type:

```ts
export type HydratedUser = {
  _id: string;
  email: string;
  name: string;
  tenantId: string;
  isAdmin: boolean;
  businessUnits: string[];
};
```

b) After fetching `userDoc` and before the `options.adminOnly` branch, add a hard guard:

```ts
if (!userDoc.tenantId) {
  // Should be impossible post-MT-1 because tenantId is required on the User
  // schema. If this ever fires it means the seed/migration missed a user.
  return apiError('UNAUTHORIZED', 'User has no tenant', 401);
}
```

c) When constructing `hydrated`, set `tenantId: userDoc.tenantId.toString()`.

d) When passing the `user` field into `runWithContext`, include `tenantId: hydrated.tenantId`.

- [ ] **Step 3: Extend `scopedQuery` to include `tenantId`**

In `lib/auth/scopedQuery.ts`, replace the body so every return value carries `tenantId`. The admin path is now "all BUs *within the tenant*"; the non-admin path is "the user's BUs *within the tenant*".

```ts
import { Types } from 'mongoose';

import { ForbiddenError } from '../utils/errors';
import type { HydratedUser } from './withAuth';

/**
 * Returns a Mongoose filter that constrains queries to the (tenant, BU) the
 * user can see. Always tenant-first. Combine into every find/findOne you write.
 *
 * Admin (within a tenant) behaviour:
 *   - No requestedBU (or 'all') → { tenantId }            (every BU in the tenant)
 *   - Specific requestedBU     → { tenantId, businessUnit }
 *
 * Non-admin behaviour:
 *   - No requestedBU (or 'all') → { tenantId, businessUnit: { $in: user.businessUnits } }
 *   - Specific BU they have    → { tenantId, businessUnit }
 *   - Specific BU they don't   → throws ForbiddenError
 *
 * Refuses if user has no tenantId — every authenticated user post-MT-1 does.
 */
export function scopedQuery(
  user: HydratedUser,
  requestedBU?: string | null,
): Record<string, unknown> {
  if (!user.tenantId) {
    throw new ForbiddenError('User has no tenant');
  }
  const tenantId = new Types.ObjectId(user.tenantId);
  const wantsAll = !requestedBU || requestedBU === 'all';

  if (user.isAdmin) {
    return wantsAll ? { tenantId } : { tenantId, businessUnit: requestedBU };
  }

  if (user.businessUnits.length === 0) {
    throw new ForbiddenError('No business unit access');
  }

  if (wantsAll) {
    return { tenantId, businessUnit: { $in: user.businessUnits } };
  }

  if (!user.businessUnits.includes(requestedBU)) {
    throw new ForbiddenError(`No access to business unit '${requestedBU}'`);
  }

  return { tenantId, businessUnit: requestedBU };
}
```

- [ ] **Step 4: Update `auditLogPlugin` to stamp `tenantId` on every entry**

In `lib/db/auditLogPlugin.ts`, find the `AuditLog.create({ ... })` call (around line 109 in the current code). Add a `tenantId` field that pulls from the doc first, the context second, null third:

```ts
// Resolve tenantId — prefer the audited doc's own tenantId; fall back to the
// actor's tenantId from requestContext (used for Tenant model edits, whose
// doc has no tenantId of its own — the actor's tenant is the right scope).
const docTenant = (doc as unknown as { tenantId?: unknown }).tenantId;
const ctxTenant = ctx?.user?.tenantId;
const tenantId =
  docTenant && Types.ObjectId.isValid(String(docTenant))
    ? new Types.ObjectId(String(docTenant))
    : ctxTenant && Types.ObjectId.isValid(ctxTenant)
      ? new Types.ObjectId(ctxTenant)
      : null;

await AuditLog.create({
  collectionName,
  documentId: doc._id as Types.ObjectId,
  tenantId,                                  // ← NEW
  action,
  // ... rest unchanged
});
```

Place the `tenantId` field after `documentId` and before `action`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS now that types are extended. (Lint will fail at the route layer until later tasks; that's fine for now.)

NOTE: `npm run lint` and the app's runtime will be in a broken intermediate state until Task 2 stamps tenantId onto the models. Do not attempt to boot the dev server between Task 1 and Task 4 — the seed has no tenantId yet.

- [ ] **Step 6: Summarize and continue to Task 2**

No commit. Internal progress only.

---

## Task 2 — Apply `tenantScopePlugin` and migrate indexes on all 15 models

**Why this is one big task:** The change is mechanically identical across the 15 models. Splitting wastes overhead.

**The recipe (apply to every model file):**

1. **Import the plugin** at the top:
   ```ts
   import { tenantScopePlugin } from '../db/tenantScopePlugin';
   ```
2. **Apply it BEFORE the other plugins** (so the `tenantId` field is added before audit hooks reference it):
   ```ts
   FooSchema.plugin(tenantScopePlugin);
   FooSchema.plugin(softDeletePlugin);
   FooSchema.plugin(auditFieldsPlugin);
   FooSchema.plugin(auditLogPlugin, { collectionName: 'foos' });
   ```
3. **Migrate every existing composite index** that starts with `businessUnit` to start with `tenantId, businessUnit`. Example:

   ```ts
   // BEFORE
   FooSchema.index({ businessUnit: 1, stage: 1, createdAt: -1 });
   // AFTER
   FooSchema.index({ tenantId: 1, businessUnit: 1, stage: 1, createdAt: -1 });
   ```

   If a composite index does NOT start with `businessUnit` (e.g., a sparse `email` index or a text index), leave it alone unless the schema rule below requires a change.

4. **Add at minimum one tenant-first compound index per model** if none exists after step 3. The simplest fallback is `Foo.index({ tenantId: 1, createdAt: -1 })`. This satisfies the CI invariant test (which now becomes load-bearing).

5. **Update the `serialize<Model>` function** to include `tenantId` in the output type and value, e.g.:
   ```ts
   tenantId: stringify(doc.tenantId),  // or String(doc.tenantId) if non-null required
   ```

**Model-specific deviations from the recipe:**

- **`User.ts`** —
  - Step 1, 2, 3, 4, 5 as above.
  - Drop `unique: true` on `email`:
    ```ts
    email: { type: String, required: true, lowercase: true, trim: true },  // removed unique
    ```
  - Add compound unique index:
    ```ts
    UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
    ```
  - The existing `UserSchema.index({ businessUnits: 1 })` becomes `UserSchema.index({ tenantId: 1, businessUnits: 1 })`.

- **`BusinessUnit.ts`** —
  - Drop `unique: true` on `key`:
    ```ts
    key: { type: String, required: true, lowercase: true, trim: true },
    ```
  - Add compound unique:
    ```ts
    BusinessUnitSchema.index({ tenantId: 1, key: 1 }, { unique: true });
    ```
  - Also add a tenant-first ordering index for the BU list page: `BusinessUnitSchema.index({ tenantId: 1, order: 1 });`.

- **`Counter.ts`** —
  - Counter has NO `softDeletePlugin`, NO `auditFields`, NO `auditLog` today — leave that exactly as-is. Just add `tenantScopePlugin`.
  - Drop `unique: true` on `key`. Add compound unique:
    ```ts
    CounterSchema.index({ tenantId: 1, key: 1 }, { unique: true });
    ```
  - The `Counter` model is used by `generateCaseNumber` / `generateInvoiceNumber` — Task 3 updates those.

- **`Settings.ts`** —
  - Apply `tenantScopePlugin`. (Settings already does NOT have softDelete — leave that.)
  - Add compound unique on tenantId so exactly one Settings doc exists per tenant:
    ```ts
    SettingsSchema.index({ tenantId: 1 }, { unique: true });
    ```
  - Update `getSettings()` signature to `getSettings(tenantId: string)`:
    ```ts
    export async function getSettings(tenantId: string): Promise<SettingsDoc> {
      const tid = new mongoose.Types.ObjectId(tenantId);
      const existing = await Settings.findOne({ tenantId: tid });
      if (existing) return existing;
      return Settings.create({ tenantId: tid });
    }
    ```

- **`AuditLog.ts`** —
  - Apply `tenantScopePlugin` so it gains a `tenantId` field. Audit-log queries already go through `scopedQuery` (`/settings/audit-log` route), so the plugin's hard guard will be satisfied.
  - Migrate the existing composite indexes to be tenant-first:
    ```ts
    AuditLogSchema.index({ tenantId: 1, documentId: 1, createdAt: -1 });
    AuditLogSchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });
    AuditLogSchema.index({ tenantId: 1, collectionName: 1, createdAt: -1 });
    AuditLogSchema.index({ tenantId: 1, businessUnit: 1, createdAt: -1 });
    ```
  - Leave the TTL index on `createdAt` alone — it's a single-key index, not composite, and TTL must be on a Date-typed single-key index.
  - Update `serializeAuditLog` to include `tenantId: stringify(doc.tenantId)` in both the return type and the body.

- **`CaseChecklist.ts`, `PipelineStage.ts`, `Document.ts`, `Task.ts`, `CalendarEvent.ts`, `SmartList.ts`, `Contact.ts`, `Lead.ts`, `Case.ts`, `Invoice.ts`** — straight recipe. No special unique constraints. Just plugin + index migration + serializer update.

**Procedure for the implementer:** Open each model file, apply the recipe + the specific deviations, save, move to the next. Do not stop between files. After ALL 15 are done, run typecheck + lint.

- [ ] **Step 1: Apply the recipe to all 15 models**

Files: every file in `lib/models/` EXCEPT `Tenant.ts` (already handled in MT-0).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Strict mode may surface places where `tenantId` is referenced before the type updates land — fix inline (most likely culprits are the `serialize*` functions whose return types now include `tenantId`).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS. The `dashboardMetrics.ts` per-line disables remain for now (Task 3 migrates them).

- [ ] **Step 4: Continue to Task 3**

No commit. No invariant test yet — it will fail until Task 4 populates the registry.

---

## Task 3 — Update Counter generators, Settings, dashboardMetrics aggregations, and call sites

**Why bundled:** All three are downstream of "model X now has tenantId" — they each take a `tenantId` argument and pass it down.

**Files:**
- Modify: `lib/services/caseNumber.ts`
- Modify: `lib/services/invoiceNumber.ts`
- Modify: `lib/services/leadConversion.ts`
- Modify: `app/api/cases/route.ts`
- Modify: `app/api/invoices/route.ts`
- Modify: `lib/services/dashboardMetrics.ts` (migrate 6 raw `.aggregate(` to `tenantAggregate`)

- [ ] **Step 1: `generateCaseNumber` takes `tenantId`**

In `lib/services/caseNumber.ts`:

```ts
import { Types, type ClientSession } from 'mongoose';

import { Counter } from '../models/Counter';

export async function generateCaseNumber(
  tenantId: string,
  businessUnit: string,
  session?: ClientSession,
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `case:${businessUnit}:${year}`;
  const tid = new Types.ObjectId(tenantId);

  const counter = await Counter.findOneAndUpdate(
    { tenantId: tid, key },
    { $inc: { value: 1 }, $setOnInsert: { tenantId: tid, key } },
    { upsert: true, returnDocument: 'after', session },
  );
  if (!counter) {
    throw new Error(`Failed to advance case-number counter for ${key}`);
  }
  const padded = String(counter.value).padStart(4, '0');
  return `${businessUnit.toUpperCase()}-${year}-${padded}`;
}
```

The `$setOnInsert` is necessary because upserts where the filter contains tenantId must also write it into the new doc on insert (Mongo doesn't copy filter fields automatically into a `$setOnInsert`-less upsert across all driver versions reliably).

- [ ] **Step 2: `generateInvoiceNumber` takes `tenantId`**

Same pattern in `lib/services/invoiceNumber.ts`:

```ts
export async function generateInvoiceNumber(
  tenantId: string,
  businessUnit: string,
  session?: ClientSession,
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `invoice:${businessUnit}:${year}`;
  const tid = new Types.ObjectId(tenantId);

  const counter = await Counter.findOneAndUpdate(
    { tenantId: tid, key },
    { $inc: { value: 1 }, $setOnInsert: { tenantId: tid, key } },
    { upsert: true, returnDocument: 'after', session },
  );
  if (!counter) {
    throw new Error(`Failed to advance invoice-number counter for ${key}`);
  }
  const padded = String(counter.value).padStart(4, '0');
  return `${businessUnit.toUpperCase()}-INV-${year}-${padded}`;
}
```

- [ ] **Step 3: Update the call sites**

`app/api/cases/route.ts` line ~90:
```ts
const caseNumber = await generateCaseNumber(user.tenantId, parsed.data.businessUnit);
```

Also, when creating the Case, include `tenantId: user.tenantId`:
```ts
const created = await Case.create({
  ...parsed.data,
  caseNumber,
  tenantId: user.tenantId,
  createdBy: user._id,
  updatedBy: user._id,
});
```

`app/api/invoices/route.ts` line ~109 — same pattern:
```ts
const invoiceNumber = await generateInvoiceNumber(user.tenantId, parsed.data.businessUnit);
const created = await Invoice.create({
  ...parsed.data,
  invoiceNumber,
  tenantId: user.tenantId,
  createdBy: user._id,
  updatedBy: user._id,
});
```

`lib/services/leadConversion.ts` — pass tenantId everywhere a record is created. The lead's own `tenantId` flows through:

```ts
// Inside the transaction, when finding the lead:
const lead = await Lead.findOne({ _id: leadId, ...scopedQuery(user) }).session(session);
// ... lead.tenantId is the tenant we operate in throughout this flow.

// Contact create:
const contact = await Contact.create([{
  ...,
  tenantId: lead.tenantId,
  // ...
}], { session });

// Case create:
const caseNumber = await generateCaseNumber(lead.tenantId.toString(), lead.businessUnit, session);
const newCase = await Case.create([{
  ...,
  tenantId: lead.tenantId,
  // ...
}], { session });
```

Audit all create call sites across all route files to ensure each `.create({...})` includes `tenantId: user.tenantId`. Grep helper: `Grep \.create\(` in `app/api/` to find them. Every business model create MUST set tenantId.

- [ ] **Step 4: Migrate the 6 `dashboardMetrics.ts` aggregations to `tenantAggregate`**

In `lib/services/dashboardMetrics.ts`, replace each of the 6 raw `.aggregate(` calls (marked with `TODO(MT-1): migrate to tenantAggregate`) with a `tenantAggregate(Model, user, [...])` call. The first `$match` stage that today sets `businessUnit: { $in: ... }` etc. should NOT include `tenantId` — `tenantAggregate` prepends that automatically.

For example:
```ts
// BEFORE
// eslint-disable-next-line no-restricted-syntax -- TODO(MT-1): migrate to tenantAggregate when tenantId reaches the user session
Lead.aggregate<AggBucket>([baseMatch, { $group: { _id: '$stage', count: { $sum: 1 } } }]),

// AFTER
tenantAggregate<AggBucket>(Lead, user, [baseMatch, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
```

Remove all 6 `eslint-disable-next-line` directives. The file must no longer contain the string `TODO(MT-1): migrate to tenantAggregate`.

After this step, `grep -rn "TODO(MT-1): migrate to tenantAggregate" lib` returns ZERO matches.

`baseMatch` likely currently looks like `{ $match: { businessUnit: { $in: user.businessUnits }, deletedAt: null } }`. Strip the `deletedAt: null` from this match — `tenantAggregate` includes it. Keep the businessUnit filter.

If `dashboardMetrics.ts` does not already receive `user` as an argument, plumb it through. Grep for callers and update.

- [ ] **Step 5: Update Settings call site in seed**

`scripts/seed.ts` line `const settings = await getSettings();` becomes `const settings = await getSettings(tenant._id.toString());` — this depends on Task 5's seed rewrite, so leave a TODO note here and the actual edit lands in Task 5.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. The lint should now have NO disables for `no-restricted-syntax` anywhere in `lib/services/dashboardMetrics.ts`.

- [ ] **Step 7: Continue to Task 4**

No commit.

---

## Task 4 — Populate the `TENANT_MODELS` registry

**Why:** This is the moment the MT-0 CI invariant test starts being load-bearing. The moment any of the 15 models is in the registry, the invariant test will check it has `tenantScopePlugin` applied (✅ done in Task 2) AND a tenant-first compound index (✅ done in Task 2).

**File:**
- Modify: `lib/tenancy/tenantModels.ts`

- [ ] **Step 1: Populate the registry**

Replace the empty `TENANT_MODELS = [] as const;` block with the full list:

```ts
import { AuditLog } from '@/lib/models/AuditLog';
import { BusinessUnit } from '@/lib/models/BusinessUnit';
import { CalendarEvent } from '@/lib/models/CalendarEvent';
import { Case } from '@/lib/models/Case';
import { CaseChecklist } from '@/lib/models/CaseChecklist';
import { Contact } from '@/lib/models/Contact';
import { Counter } from '@/lib/models/Counter';
import { Document } from '@/lib/models/Document';
import { Invoice } from '@/lib/models/Invoice';
import { Lead } from '@/lib/models/Lead';
import { PipelineStage } from '@/lib/models/PipelineStage';
import { Settings } from '@/lib/models/Settings';
import { SmartList } from '@/lib/models/SmartList';
import { Task as TaskModel } from '@/lib/models/Task';
import { User } from '@/lib/models/User';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TENANT_MODELS: ReadonlyArray<{ model: Model<any>; label: string }> = [
  { model: AuditLog,       label: 'auditLogs' },
  { model: BusinessUnit,   label: 'businessUnits' },
  { model: CalendarEvent,  label: 'calendarEvents' },
  { model: Case,           label: 'cases' },
  { model: CaseChecklist,  label: 'caseChecklists' },
  { model: Contact,        label: 'contacts' },
  { model: Counter,        label: 'counters' },
  { model: Document,       label: 'documents' },
  { model: Invoice,        label: 'invoices' },
  { model: Lead,           label: 'leads' },
  { model: PipelineStage,  label: 'pipelineStages' },
  { model: Settings,       label: 'settings' },
  { model: SmartList,      label: 'smartLists' },
  { model: TaskModel,      label: 'tasks' },
  { model: User,           label: 'users' },
] as const;
```

Note: `Task` is renamed `TaskModel` on import to avoid colliding with TypeScript's built-in `Task` (in some lib contexts) and the project's `TaskCreate` harness tool name.

`Tenant` is deliberately NOT in this list (it's above the tenant boundary).

- [ ] **Step 2: Run the invariant test**

Run: `npm run test:multitenancy`
Expected: PASS — all three invariants hold for all 15 registered models.

If any model fails any invariant, go back to Task 2 for that model and fix:
- Missing plugin → recipe step 2 (`Foo.plugin(tenantScopePlugin)`)
- Missing tenant-first index → recipe step 4

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Continue to Task 5**

No commit.

---

## Task 5 — Rewrite the seed script

**Why:** Before Task 5, the seed creates BUs/Users/Settings without `tenantId` — the new model schemas reject those creates. The seed needs a full rewrite to create a Tenant first, then stamp `tenantId` on every record.

**File:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Rewrite `scripts/seed.ts`**

Replace the file contents with:

```ts
/**
 * MT-1 foundation seed. Per spec §8 MT-1, MT-1 wipes the DB and seeds one
 * default tenant. Multi-tenant signup arrives in MT-2.
 *
 *   npm run seed         # idempotent — inserts missing records, leaves existing alone
 *   npm run seed:reset   # drops the entire DB and reseeds from scratch
 *
 * What it creates:
 *   - 1 default Tenant: { slug: 'default', name: 'Default Firm', status: 'active' }
 *   - 3 default BUs scoped to that tenant (immigration, law, wealth)
 *   - 1 admin user (SEED_ADMIN_*) scoped to that tenant, access to all BUs
 *   - 1 standard user (lawyer@example.com) scoped to that tenant, law-only
 *   - 1 Settings doc for that tenant
 *
 * Same password for both users — for development only.
 */

import mongoose from 'mongoose';

import { hashPassword } from '../lib/auth/password';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { BusinessUnit } from '../lib/models/BusinessUnit';
import { getSettings } from '../lib/models/Settings';
import { Tenant } from '../lib/models/Tenant';
import { User } from '../lib/models/User';

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'System Admin';

const STD_EMAIL = 'lawyer@example.com';
const STD_NAME = 'Test Lawyer (Law only)';

const TENANT_SLUG = 'default';
const TENANT_NAME = 'Default Firm';

const RESET = process.argv.includes('--reset');

const DEFAULT_BUS = [
  { key: 'immigration', name: 'Immigration', description: 'Visa applications, status tracking, document workflows.', color: '#0ea5e9', order: 1 },
  { key: 'law',         name: 'Law',         description: 'Case management, hearings, billable time.',                color: '#8b5cf6', order: 2 },
  { key: 'wealth',      name: 'Wealth',      description: 'Portfolio reviews, advisory cases, compliance.',           color: '#10b981', order: 3 },
] as const;

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}

async function main(): Promise<void> {
  console.log('\nSeeding (MT-1 default tenant)\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  if (RESET) {
    log('reset', `dropping entire database "${mongoose.connection.name}"`);
    await mongoose.connection.dropDatabase();
  }

  // 1. Tenant — upsert.
  const tenant = await Tenant.findOneAndUpdate(
    { slug: TENANT_SLUG },
    {
      $setOnInsert: {
        slug: TENANT_SLUG,
        name: TENANT_NAME,
        status: 'active',
        ownerEmail: ADMIN_EMAIL,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  if (!tenant) throw new Error('Tenant upsert returned no doc');
  log('tenant', `${tenant.slug} → ${tenant.name} (_id=${tenant._id})`);

  const tenantId = tenant._id;

  // 2. Business units — upsert each, scoped to tenant.
  for (const bu of DEFAULT_BUS) {
    const doc = await BusinessUnit.findOneAndUpdate(
      { tenantId, key: bu.key },
      { $setOnInsert: { ...bu, tenantId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    if (!doc) throw new Error(`BU upsert ${bu.key} returned no doc`);
    log('bu', `${doc.key} → ${doc.name}`);
  }

  // 3. Admin user.
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const admin = await User.findOneAndUpdate(
    { tenantId, email: ADMIN_EMAIL },
    {
      $setOnInsert: {
        tenantId,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash,
        isAdmin: true,
        businessUnits: DEFAULT_BUS.map((b) => b.key),
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  if (!admin) throw new Error('Admin upsert returned no doc');
  log('admin', `${admin.email} (isAdmin=${admin.isAdmin})`);

  // 4. Standard user (law-only).
  const std = await User.findOneAndUpdate(
    { tenantId, email: STD_EMAIL },
    {
      $setOnInsert: {
        tenantId,
        email: STD_EMAIL,
        name: STD_NAME,
        passwordHash,
        isAdmin: false,
        businessUnits: ['law'],
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  if (!std) throw new Error('Std user upsert returned no doc');
  log('user', `${std.email} (BUs=${std.businessUnits.join(', ')})`);

  // 5. Settings.
  const settings = await getSettings(tenantId.toString());
  log('settings', `org="${settings.organizationName}"`);

  console.log('\nDone. Credentials:');
  console.log(`  admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  user:  ${STD_EMAIL} / ${ADMIN_PASSWORD}\n`);

  await disconnectDb();
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
```

Key changes from the old seed:
- Imports `Tenant` and removes the `AuditLog` import (no audit cleanup needed when we drop the whole DB).
- `--reset` now does `dropDatabase()` instead of per-collection wipes.
- Every upsert filter and `$setOnInsert` carries `tenantId`.
- `getSettings(tenantId.toString())` matches the new MT-1 signature.

- [ ] **Step 2: Drop and re-seed**

Run: `npm run seed:reset`
Expected: clean run, no errors, output ending with the credentials block.

- [ ] **Step 3: Spot-check the DB**

Connect to the DB (the existing test scripts confirm `connectDb()` works), or use the Mongo shell / Compass:
- `tenants` collection has 1 doc.
- `users` collection has 2 docs, both with `tenantId` matching the Tenant's `_id`.
- `businessunits` collection has 3 docs, all with `tenantId` matching.
- `settings` collection has 1 doc with `tenantId` matching.

This is the user's job, not the implementer's — but the implementer should at least verify the seed run produced no validation errors.

- [ ] **Step 4: Re-run the invariant test (now load-bearing with real models)**

Run: `npm run test:multitenancy`
Expected: PASS — all 15 registered models pass all three invariants.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Continue to Task 6**

No commit.

---

## Task 6 — Final regression sweep before handoff

**Why:** Tasks 1–5 made changes across every layer. This task is a fast end-to-end check that nothing in the existing app surface (which the spec says must keep working identically) is broken.

- [ ] **Step 1: Run every test script**

```
npm run test:plugins         # confirms audit log, soft-delete, audit fields still work
npm run test:tenant-scope    # confirms plugin + helper unchanged
npm run test:multitenancy    # confirms 15 models all pass invariants
```

All three must PASS.

- [ ] **Step 2: Run the conversion test**

```
npm run test:conversion
```

This script lives at `scripts/test-conversion.ts` and exercises the lead → case conversion flow end-to-end. It hits Lead, Contact, Case, and Counter. If `leadConversion.ts` was updated correctly in Task 3, this passes.

If it fails, the most likely cause is a missing `tenantId` on a `.create(...)` call in `leadConversion.ts`. Re-read Task 3 step 3 and audit.

- [ ] **Step 3: Run the smart-list test**

```
npm run test:smart-list
```

Exercises smart-list filter translation. Confirms SmartList queries still work post-MT-1.

- [ ] **Step 4: Final typecheck + lint**

```
npm run typecheck
npm run lint
```

Both must pass.

- [ ] **Step 5: Report to user — phase complete, ready for manual gate**

End here. No commit. The user runs the manual gate below.

---

## MT-1 smoke-test gate (user runs these)

```powershell
npm run typecheck
npm run lint
npm run test:multitenancy   # 15-model invariants (LOAD-BEARING now)
npm run test:tenant-scope   # plugin + helper
npm run test:plugins        # Phase 0b regression
npm run test:conversion     # lead → case multi-collection flow
npm run test:smart-list     # filter translation
npm run seed:reset          # rebuilds DB with default tenant
npm run dev                 # boot
```

## MT-1 manual gate

**Round 1 — admin user (sees everything in the tenant):**

- [ ] Sign in as `admin@example.com` / `ChangeMe123!`.
- [ ] Dashboard loads without errors. Counts may be zero (new DB) — that's fine.
- [ ] Leads page loads (empty list is fine).
- [ ] Create a new lead in BU "law". Save. Lead appears in the list.
- [ ] Create another lead in BU "immigration". Both leads visible.
- [ ] Cases page — empty, fine.
- [ ] Open the law-BU lead. Convert it to a case with title "Smoke Case A". Case is created (note its number, e.g., `LAW-2026-0001`). Contact is created.
- [ ] Cases page shows "Smoke Case A".
- [ ] Contacts page shows the new contact.
- [ ] Create an invoice for that case. Invoice number generates (e.g., `LAW-INV-2026-0001`).
- [ ] Settings → Audit log — recent entries visible (create lead, convert, create invoice).

**Round 2 — standard user (law-only, sees only law BU within the tenant):**

- [ ] Sign out, sign in as `lawyer@example.com` / `ChangeMe123!`.
- [ ] Dashboard loads.
- [ ] Leads page shows ONLY the "law" lead. The "immigration" lead is invisible.
- [ ] Cases page shows "Smoke Case A".
- [ ] Settings link is not visible in the sidebar (not admin).
- [ ] Navigating to `/settings/users` redirects (handled by middleware).

If both rounds pass, MT-1 is done. Commit with a message like:
`feat: MT-1 — stamp tenantId across all models, populate registry, rewrite seed`

---

## Self-review notes

- **Spec coverage:** §3.1 Tenant (done in MT-0), §3.2 tenantId per model (Task 2), §3.3 indexes (Task 2 recipe step 3), §3.4 unique constraints (Task 2 per-model deviations), §3.5 Settings (Task 2 + Task 3), §3.6 AuditLog (Task 2 deviation + Task 1 step 4 plugin update), §6.1 TENANT_MODELS populated (Task 4), MT-1 from §8 (whole plan).
- **Placeholder scan:** zero `TBD`/`TODO`-in-plan markers. The 6 `TODO(MT-1)` markers in code are EXPECTED to disappear during Task 3 step 4.
- **Type consistency:** `tenantId` is `ObjectId` at the model level and `string` at the carrier level (`HydratedUser.tenantId`, `RequestUser.tenantId`, `user.tenantId` in routes). Conversions happen at the boundary — `new Types.ObjectId(user.tenantId)` going down, `String(doc.tenantId)` coming up.
- **Scope:** MT-1 only. Signup, JWT changes, operator console, purge — all explicitly deferred in the File Map header.
- **Ambiguity:** `setDefaultsOnInsert: true` on the upserts is intentional — without it, `default: 'active'` etc. on the Tenant schema would not apply on insert, leading to silent null-status seed documents.
