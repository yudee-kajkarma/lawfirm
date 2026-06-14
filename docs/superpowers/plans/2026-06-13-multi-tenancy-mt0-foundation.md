# Multi-Tenancy MT-0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Project rule — commits are user-owned:** Every "commit step" in this plan stops at staging-ready summary. **DO NOT run `git add` or `git commit`.** Wait for the user to verify (smoke test + UI walkthrough) and commit themselves.

**Goal:** Land the foundational infrastructure for row-level multi-tenancy — Tenant model, scoping plugin, aggregate helper, eslint ban on raw aggregation, registry skeleton, and CI invariant test. **No app behavior change yet** — every existing route and page continues to work identically after this phase.

**Architecture:** Row-level isolation (Approach A from the spec). MT-0 is the "scaffolding before load-bearing wall" phase: every safeguard the spec describes is built and self-tested, but `tenantId` is not yet on any existing model. That happens in MT-1.

**Tech Stack:** Next.js 15, Mongoose 9, TypeScript 5.7, ESLint 9 (flat config), tsx for runnable test scripts (no jest/vitest in this project — tests are tsx scripts that connect to MongoDB and `process.exit(0|1)`; pattern established in `scripts/test-plugins.ts`).

**Spec reference:** `docs/superpowers/specs/2026-06-13-multi-tenancy-design.md` — sections 3.1 (Tenant model), 4 (safeguards), 6.1 (TENANT_MODELS), 8 (phasing).

---

## File map

**Create:**
- `lib/tenancy/tenantModels.ts` — `TENANT_MODELS` registry (empty in MT-0, populated in MT-1) and `TENANT_SCOPE_PLUGIN_SYMBOL`.
- `lib/db/tenantScopePlugin.ts` — Mongoose plugin that adds `tenantId` schema path and refuses queries missing `tenantId`.
- `lib/tenancy/tenantAggregate.ts` — wrapper that prepends `{ $match: { tenantId, deletedAt: null } }` to every aggregation pipeline.
- `lib/models/Tenant.ts` — the `Tenant` model (does NOT use `tenantScopePlugin`; it's the top of the tenant hierarchy).
- `lib/utils/validators/tenant.ts` — Zod schemas (signup payload, status enum). Used by MT-2's signup; created here so the type is in place.
- `scripts/test-tenant-scope.ts` — integration test for plugin + aggregate helper (DB-backed, throwaway model, same pattern as `scripts/test-plugins.ts`).
- `scripts/test-multitenancy-invariants.ts` — pure-Node CI meta-test (no DB) that iterates `mongoose.models` and asserts the three invariants from spec §4.4.

**Modify:**
- `eslint.config.mjs` — add `no-restricted-syntax` rule banning `.aggregate(`.
- `package.json` — add `test:tenant-scope` and `test:multitenancy` scripts.

**Out of scope for MT-0 (deferred to MT-1):**
- Adding `tenantId` to any existing model.
- Extending `scopedQuery()` (it stays as-is; nothing has `tenantId` yet so there's nothing to scope by).
- Extending `HydratedUser` / `RequestContext` with `tenantId`.

---

## Task 1: TENANT_MODELS registry skeleton + plugin symbol

**Why first:** The plugin tags schemas with a Symbol from this file; the invariant test imports the registry. Both Task 2 and Task 7 depend on this file existing first.

**Files:**
- Create: `lib/tenancy/tenantModels.ts`

- [ ] **Step 1: Create the registry file**

```ts
// lib/tenancy/tenantModels.ts
import type { Model } from 'mongoose';

/**
 * Marker symbol planted on a schema by `tenantScopePlugin` so the CI invariant
 * test can verify that every registered model actually has the plugin applied.
 * Symbol.for() guarantees the same identity across HMR reloads.
 */
export const TENANT_SCOPE_PLUGIN_SYMBOL = Symbol.for('instapath.tenantScopePlugin');

/**
 * Single source of truth for "every model that carries `tenantId`".
 *
 * Used by:
 *  - the purge pipeline (iterates this list to wipe a tenant)
 *  - the CI invariant test (asserts every model in here has `tenantScopePlugin`
 *    AND a tenant-first compound index, and conversely that every model with
 *    a `tenantId` schema path is in this list)
 *
 * Empty in MT-0 by design. MT-1 stamps `tenantId` onto each business model
 * and adds it here in the same change.
 *
 * `Tenant` itself is NEVER added here — it sits above the tenant hierarchy
 * and is deleted last (by hand) after the registry-iterated sweep completes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TENANT_MODELS: ReadonlyArray<{ model: Model<any>; label: string }> = [
  // MT-1 will populate this list. See spec §6.1.
] as const;
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 3: Summarize and stop**

Summary to user:
> "Task 1 ready for review. Created `lib/tenancy/tenantModels.ts` with the registry skeleton (empty list — MT-1 populates it) and the plugin symbol. Typecheck passes."

**DO NOT commit.** Wait for the user.

---

## Task 2: tenantScopePlugin (write the test first, then the plugin)

**Why this task is shaped this way:** The plugin's contract is "throw if tenantId is missing from any query unless explicitly opted out". That's an exceptional behavior — the most useful test is an integration test that exercises real Mongoose queries against a real DB.

**Files:**
- Create: `scripts/test-tenant-scope.ts`
- Create: `lib/db/tenantScopePlugin.ts`
- Modify: `package.json` (add `test:tenant-scope` script)

- [ ] **Step 1: Add the npm script**

Modify `package.json` `scripts` block, append after `test:smart-list`:

```json
    "test:tenant-scope": "tsx --env-file=.env.local scripts/test-tenant-scope.ts",
```

- [ ] **Step 2: Write the failing integration test**

Create `scripts/test-tenant-scope.ts`:

```ts
/**
 * MT-0 smoke test for tenantScopePlugin + tenantAggregate.
 *
 * Run with:  npm run test:tenant-scope
 *
 * Verifies:
 *   1. Query without `tenantId` throws.
 *   2. Query with `tenantId` works.
 *   3. `.setOptions({ __crossTenant: true })` lets a query run without `tenantId`.
 *   4. Schema is tagged with TENANT_SCOPE_PLUGIN_SYMBOL.
 *   5. tenantAggregate scopes to the user's tenant. (Added in Task 3.)
 *
 * Exit code 0 on success, 1 on assertion failure.
 */

import mongoose, { Schema, Types } from 'mongoose';

import { connectDb, disconnectDb } from '../lib/db/connect';
import { tenantScopePlugin } from '../lib/db/tenantScopePlugin';
import { TENANT_SCOPE_PLUGIN_SYMBOL } from '../lib/tenancy/tenantModels';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}

function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

const ScopeFooSchema = new Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true },
);
ScopeFooSchema.plugin(tenantScopePlugin);

type ScopeFooDoc = mongoose.InferSchemaType<typeof ScopeFooSchema> & {
  _id: Types.ObjectId;
};
const ScopeFoo: mongoose.Model<ScopeFooDoc> =
  (mongoose.models.ScopeFoo as mongoose.Model<ScopeFooDoc>) ??
  mongoose.model<ScopeFooDoc>('ScopeFoo', ScopeFooSchema);

async function main(): Promise<void> {
  console.log('\nMT-0 tenant scope plugin smoke test\n');

  await connectDb();
  log('connect', `connected to ${mongoose.connection.name}`);

  const tenantA = new Types.ObjectId();
  const tenantB = new Types.ObjectId();

  // Cleanup any prior run.
  await ScopeFoo.collection.deleteMany({});

  // Seed: one doc per tenant.
  await ScopeFoo.collection.insertMany([
    { tenantId: tenantA, name: 'a-doc' },
    { tenantId: tenantB, name: 'b-doc' },
  ]);
  log('seed', 'inserted one doc per tenant via raw driver');

  // 1. Query without tenantId throws.
  let threw = false;
  try {
    await ScopeFoo.find({});
  } catch (err) {
    threw = true;
    log('no-tenant', `correctly threw: ${(err as Error).message}`);
  }
  if (!threw) fail('no-tenant', 'expected query without tenantId to throw');

  // 2. Query with tenantId works and is scoped.
  const aResults = await ScopeFoo.find({ tenantId: tenantA });
  if (aResults.length !== 1 || aResults[0].name !== 'a-doc') {
    fail('with-tenant', `expected 1 result for tenantA, got ${aResults.length}`);
  }
  log('with-tenant', 'query with tenantId returns only that tenant\'s docs ✓');

  // 3. __crossTenant opt-out lets queries run without tenantId.
  const allResults = await ScopeFoo.find({}).setOptions({ __crossTenant: true });
  if (allResults.length !== 2) {
    fail('cross-tenant', `expected 2 cross-tenant results, got ${allResults.length}`);
  }
  log('cross-tenant', '__crossTenant: true returns all docs ✓');

  // 4. Schema is tagged with the plugin symbol.
  const tagged = Boolean(
    (ScopeFooSchema as unknown as Record<symbol, unknown>)[TENANT_SCOPE_PLUGIN_SYMBOL],
  );
  if (!tagged) fail('symbol', 'schema is not tagged with TENANT_SCOPE_PLUGIN_SYMBOL');
  log('symbol', 'schema correctly tagged ✓');

  // 5. tenantAggregate — added in Task 3.

  // Cleanup.
  await ScopeFoo.collection.deleteMany({});
  log('cleanup', 'removed test docs');

  await disconnectDb();
  console.log('\n  ✓ MT-0 tenant scope plugin smoke test passed\n');
}

main().catch((err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the test, expect a clear failure**

Run: `npm run test:tenant-scope`
Expected: FAIL — likely "Cannot find module `../lib/db/tenantScopePlugin`" or similar.

(This is the TDD red.)

- [ ] **Step 4: Implement the plugin**

Create `lib/db/tenantScopePlugin.ts`:

```ts
import type { Schema } from 'mongoose';

import { TENANT_SCOPE_PLUGIN_SYMBOL } from '../tenancy/tenantModels';

/**
 * Mongoose plugin that adds `tenantId: ObjectId` (required, indexed) to the
 * schema and REFUSES to run any query that doesn't include `tenantId` in its
 * filter — throws loudly. A forgotten `tenantId` is a screaming error in dev,
 * not a silent leak in prod.
 *
 * Opt out explicitly with `.setOptions({ __crossTenant: true })` for legitimate
 * cross-tenant code (operator console, the purge sweep). That flag is grep-able;
 * every occurrence outside `app/api/operator/**` and `scripts/**` is a review
 * red flag.
 *
 * Aggregations bypass middleware — use `tenantAggregate()` instead of
 * `Model.aggregate(...)`. The eslint rule in `eslint.config.mjs` enforces this.
 */

declare module 'mongoose' {
  interface QueryOptions {
    __crossTenant?: boolean;
  }
}

export function tenantScopePlugin(schema: Schema): void {
  schema.add({
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
  });

  // Tag the schema so the CI invariant test can verify plugin application.
  // Using Object.defineProperty + symbol so it isn't enumerated by anything.
  Object.defineProperty(schema, TENANT_SCOPE_PLUGIN_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  // `this` is a Mongoose Query whose concrete generic varies per op — `any`
  // keeps the helper reusable. Same pattern as softDeletePlugin.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function requireTenantId(this: any): void {
    const opts = this.getOptions();
    if (opts.__crossTenant) return;
    const filter = this.getQuery();
    if (filter.tenantId === undefined) {
      const modelName =
        (this.model && this.model.modelName) || (this.mongooseCollection?.name ?? 'unknown');
      throw new Error(
        `[tenantScopePlugin] query on "${modelName}" is missing tenantId. ` +
          `Use scopedQuery(user) to build the filter, or set __crossTenant: true ` +
          `explicitly for cross-tenant operator code.`,
      );
    }
  }

  schema.pre('find', requireTenantId);
  schema.pre('findOne', requireTenantId);
  schema.pre('count', requireTenantId);
  schema.pre('countDocuments', requireTenantId);
  schema.pre('updateOne', requireTenantId);
  schema.pre('updateMany', requireTenantId);
  schema.pre('deleteOne', requireTenantId);
  schema.pre('deleteMany', requireTenantId);
  schema.pre('findOneAndUpdate', requireTenantId);
}
```

- [ ] **Step 5: Run the test, expect green**

Run: `npm run test:tenant-scope`
Expected: PASS — all 4 of the in-script assertions log a `✓` and the script prints "MT-0 tenant scope plugin smoke test passed".

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: Both pass.

- [ ] **Step 7: Summarize and stop**

Summary to user:
> "Task 2 ready for review. Created `lib/db/tenantScopePlugin.ts` + integration test `scripts/test-tenant-scope.ts` + npm script. `npm run test:tenant-scope` passes (4/4 assertions). Typecheck + lint clean."

**DO NOT commit.** Wait for the user to verify and commit.

---

## Task 3: tenantAggregate helper + extend the integration test

**Why:** Aggregations bypass middleware. Without this helper, an operator-shaped pipeline like `Model.aggregate([{ $match: { status: 'open' } }])` would silently scan across tenants. The helper makes the tenant filter the first stage of every pipeline.

**Files:**
- Create: `lib/tenancy/tenantAggregate.ts`
- Modify: `scripts/test-tenant-scope.ts` (extend with aggregate cases)

- [ ] **Step 1: Extend the test FIRST — add failing assertions for aggregate**

In `scripts/test-tenant-scope.ts`, replace the line `// 5. tenantAggregate — added in Task 3.` with:

```ts
  // 5. Raw aggregate WITHOUT tenant scope returns docs from both tenants (the leak).
  const leak = await ScopeFoo.aggregate([{ $match: {} }]).option({ __crossTenant: true });
  if (leak.length !== 2) {
    fail('aggregate-leak', `expected raw aggregate to see 2 docs (the leak we're guarding), got ${leak.length}`);
  }
  log('aggregate-leak', 'raw aggregate sees both tenants (confirming why the helper is needed) ✓');

  // 6. tenantAggregate scopes to the user's tenant.
  const { tenantAggregate } = await import('../lib/tenancy/tenantAggregate');
  const fakeUserA = { tenantId: tenantA.toString() } as { tenantId: string };
  const aOnly = await tenantAggregate<{ name: string }>(ScopeFoo, fakeUserA, [
    { $project: { name: 1, _id: 0 } },
  ]);
  if (aOnly.length !== 1 || aOnly[0].name !== 'a-doc') {
    fail('aggregate-scoped', `expected tenantAggregate to return only tenantA's 1 doc, got ${aOnly.length}`);
  }
  log('aggregate-scoped', 'tenantAggregate returns only the user\'s tenant ✓');

  // 7. tenantAggregate refuses to run if user has no tenantId.
  let aggThrew = false;
  try {
    await tenantAggregate(ScopeFoo, { tenantId: '' } as { tenantId: string }, []);
  } catch (err) {
    aggThrew = true;
    log('aggregate-empty', `correctly threw: ${(err as Error).message}`);
  }
  if (!aggThrew) fail('aggregate-empty', 'expected tenantAggregate to refuse empty tenantId');
```

Note: the `.option({ __crossTenant: true })` on the leak case is intentional — even raw aggregation in this test is gated through the plugin's options because the plugin DOES apply a `pre('aggregate')` is... wait, the plugin does NOT hook aggregate (Section 4.1 says so explicitly — middleware doesn't catch aggregate). So `.option(...)` here is unnecessary. Drop it:

Replace the leak block with:

```ts
  // 5. Raw aggregate WITHOUT tenant scope returns docs from both tenants (the leak).
  // The plugin does NOT hook aggregate — that's WHY we have tenantAggregate.
  const leak = await ScopeFoo.aggregate([{ $match: {} }]);
  if (leak.length !== 2) {
    fail('aggregate-leak', `expected raw aggregate to see 2 docs (the leak we're guarding), got ${leak.length}`);
  }
  log('aggregate-leak', 'raw aggregate sees both tenants (confirming why the helper is needed) ✓');
```

- [ ] **Step 2: Run the test, expect failure on the import**

Run: `npm run test:tenant-scope`
Expected: FAIL — `Cannot find module '../lib/tenancy/tenantAggregate'`.

- [ ] **Step 3: Implement the helper**

Create `lib/tenancy/tenantAggregate.ts`:

```ts
import { Types, type Model, type PipelineStage } from 'mongoose';

/**
 * Wrapper around `Model.aggregate()` that prepends
 *   { $match: { tenantId, deletedAt: null } }
 * to every pipeline. Use this instead of `Model.aggregate(...)` everywhere.
 *
 * Aggregations bypass Mongoose middleware, which means `tenantScopePlugin`
 * cannot enforce tenant scoping on them. This helper is the single chokepoint
 * for aggregation; the `no-restricted-syntax` eslint rule in `eslint.config.mjs`
 * bans raw `.aggregate(` calls in app code.
 *
 * Operator-console code that legitimately needs cross-tenant aggregation
 * disables the eslint rule on a per-line basis with a rationale comment.
 */

type TenantScopedUser = { tenantId: string };

export async function tenantAggregate<TResult = Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  user: TenantScopedUser,
  pipeline: PipelineStage[],
): Promise<TResult[]> {
  if (!user.tenantId || !Types.ObjectId.isValid(user.tenantId)) {
    throw new Error(
      `[tenantAggregate] called with invalid tenantId="${user.tenantId}" on model ${model.modelName}`,
    );
  }
  const tenantId = new Types.ObjectId(user.tenantId);
  return model.aggregate<TResult>([
    { $match: { tenantId, deletedAt: null } },
    ...pipeline,
  ]);
}
```

- [ ] **Step 4: Run the test, expect green**

Run: `npm run test:tenant-scope`
Expected: PASS — all 7 assertions log `✓`.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: Both pass.

- [ ] **Step 6: Summarize and stop**

Summary to user:
> "Task 3 ready for review. Created `lib/tenancy/tenantAggregate.ts`; extended test to 7 assertions including the deliberate 'leak' assertion proving the helper is needed. All pass."

**DO NOT commit.** Wait for the user.

---

## Task 4: eslint rule banning raw `.aggregate(`

**Why:** Layer 3 of the safeguards. The plugin can't hook aggregate, the helper exists, now the linter enforces use of the helper. (Grep confirmed zero existing `.aggregate(` call sites in app code, so introducing this rule breaks nothing today.)

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Modify eslint config**

Replace the existing `eslint.config.mjs` contents with:

```js
import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    // Multi-tenancy guardrail: raw `.aggregate(` bypasses tenantScopePlugin
    // (middleware doesn't run on aggregations). Use tenantAggregate() instead.
    // Allowed only inside the helper itself and the smoke test that proves
    // the leak exists.
    files: ['**/*.{ts,tsx}'],
    ignores: [
      'lib/tenancy/tenantAggregate.ts',
      'scripts/test-tenant-scope.ts',
      // operator-console code (added in MT-3) can opt out per-line with
      // // eslint-disable-next-line no-restricted-syntax -- cross-tenant, intentional
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='aggregate']",
          message:
            'Use tenantAggregate() from lib/tenancy/tenantAggregate — raw .aggregate() bypasses tenant scoping.',
        },
      ],
    },
  },
];

export default config;
```

- [ ] **Step 2: Verify the rule fires on a raw aggregate call**

Create a throwaway file `lib/__rule_check__.ts`:

```ts
// Temporary file to verify the eslint rule. Delete after verifying.
import mongoose from 'mongoose';
declare const M: mongoose.Model<unknown>;
M.aggregate([]);
```

Run: `npm run lint -- lib/__rule_check__.ts`
Expected: FAIL with the message "Use tenantAggregate() from lib/tenancy/tenantAggregate — raw .aggregate() bypasses tenant scoping."

- [ ] **Step 3: Delete the throwaway file**

```powershell
Remove-Item lib/__rule_check__.ts
```

- [ ] **Step 4: Confirm the real codebase still lints clean**

Run: `npm run lint`
Expected: PASS — no errors. (The helper and smoke test are in the `ignores` list; no app code uses raw aggregate.)

- [ ] **Step 5: Summarize and stop**

Summary to user:
> "Task 4 ready for review. ESLint rule banning raw .aggregate() is live. Verified it fires on a throwaway file (then deleted the file), and confirmed the full codebase still lints clean."

**DO NOT commit.** Wait for the user.

---

## Task 5: Tenant model + Zod validators

**Why:** The Tenant collection has to exist before MT-2 (signup) can write to it. The model is small and standalone — fits cleanly in MT-0. Zod schemas come along so the types are available when MT-2 lands.

**Files:**
- Create: `lib/models/Tenant.ts`
- Create: `lib/utils/validators/tenant.ts`

- [ ] **Step 1: Create the Tenant model**

Create `lib/models/Tenant.ts`:

```ts
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';

/**
 * The top of the tenant hierarchy.
 *
 * Deliberate omissions:
 *   - No `softDeletePlugin`. A tenant is either present (active / suspended /
 *     pending_purge / purging) or hard-deleted by the purge pipeline. There is
 *     no "deleted-but-recoverable" state for a tenant.
 *   - No `tenantScopePlugin`. The Tenant model sits ABOVE the tenant boundary.
 *
 * `auditLogPlugin` IS applied — every state transition (suspend, reactivate,
 * schedule-purge, cancel-purge) writes to the regular audit log so tenant
 * admins can see actions on their own tenant.
 */

export const TENANT_STATUSES = [
  'active',
  'suspended',
  'pending_purge',
  'purging',
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

const TenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: TENANT_STATUSES,
      default: 'active',
      index: true,
    },
    suspendedAt: { type: Date, default: null },
    purgeScheduledAt: { type: Date, default: null, index: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

TenantSchema.plugin(auditFieldsPlugin);
TenantSchema.plugin(auditLogPlugin, { collectionName: 'tenants' });

export type TenantDoc = InferSchemaType<typeof TenantSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Tenant: Model<TenantDoc> =
  (mongoose.models.Tenant as Model<TenantDoc>) ??
  mongoose.model<TenantDoc>('Tenant', TenantSchema);

export function serializeTenant(doc: Record<string, unknown>): {
  _id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  suspendedAt: string | null;
  purgeScheduledAt: string | null;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
} {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  const isoDateOrNull = (v: unknown): string | null =>
    v == null ? null : isoDate(v);
  return {
    _id: String(doc._id),
    name: String(doc.name ?? ''),
    slug: String(doc.slug ?? ''),
    status: (doc.status as TenantStatus) ?? 'active',
    suspendedAt: isoDateOrNull(doc.suspendedAt),
    purgeScheduledAt: isoDateOrNull(doc.purgeScheduledAt),
    ownerEmail: String(doc.ownerEmail ?? ''),
    createdAt: isoDate(doc.createdAt),
    updatedAt: isoDate(doc.updatedAt),
  };
}
```

- [ ] **Step 2: Create Zod validators**

Create `lib/utils/validators/tenant.ts`:

```ts
import { z } from 'zod';

import { TENANT_STATUSES } from '@/lib/models/Tenant';

/**
 * Used by the signup endpoint in MT-2. Defined here in MT-0 so the type is
 * available the moment signup is wired up.
 *
 * `companyName` becomes `Tenant.name`. The slug is derived server-side from
 * the company name with a uniqueness suffix on collision — never client-input.
 */
export const tenantSignupSchema = z.object({
  companyName: z.string().min(1).max(120).trim(),
  ownerName: z.string().min(1).max(120).trim(),
  ownerEmail: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
});

export type TenantSignupInput = z.infer<typeof tenantSignupSchema>;

export const tenantStatusSchema = z.enum(TENANT_STATUSES);
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: Both pass.

- [ ] **Step 4: Quick model sanity check**

A one-off sanity check that the Tenant model loads and Mongoose can create the indexes (no extra script — just import-and-check via `tsx -e`):

Run (PowerShell):
```powershell
npx tsx --env-file=.env.local -e "import('./lib/models/Tenant.ts').then(({ Tenant }) => Tenant.init().then(() => console.log('OK indexes:', JSON.stringify(Object.keys(Tenant.collection.collection.indexInformation ? {} : {})))).then(() => process.exit(0))"
```

If that one-liner is awkward in your shell, an equivalent is just running the existing `npm run test:plugins` (which connects to the same DB) — if it still passes, Mongoose is happy with the new model definition.

Expected: no errors.

- [ ] **Step 5: Summarize and stop**

Summary to user:
> "Task 5 ready for review. Created `lib/models/Tenant.ts` (audit-logged, NO soft-delete by design, NOT a tenant-scoped model) and `lib/utils/validators/tenant.ts` (signup schema + status enum). Typecheck + lint clean."

**DO NOT commit.** Wait for the user.

---

## Task 6: CI invariant test + npm script

**Why:** The mechanical guarantee from spec §4.4. In MT-0 the registry is empty and no model has `tenantId`, so the test trivially passes — but it's already wired up, so MT-1 (which stamps `tenantId` everywhere) will be guarded from the moment the first model is added.

**Files:**
- Create: `scripts/test-multitenancy-invariants.ts`
- Modify: `package.json` (add `test:multitenancy` script)

- [ ] **Step 1: Add the npm script**

Modify `package.json` `scripts` block, append after `test:tenant-scope`:

```json
    "test:multitenancy": "tsx scripts/test-multitenancy-invariants.ts",
```

(Note: no `--env-file=.env.local` and no `connectDb()` — this test inspects mongoose.models in-memory only. No DB hit. Fast enough to run in every CI invocation.)

- [ ] **Step 2: Create the test**

Create `scripts/test-multitenancy-invariants.ts`:

```ts
/**
 * MT-0 CI invariant test — the mechanical guarantee from spec §4.4.
 *
 * Asserts:
 *   1. Every model with a `tenantId` schema path is registered in TENANT_MODELS.
 *   2. Every model in TENANT_MODELS has `tenantScopePlugin` applied (symbol tag).
 *   3. Every model in TENANT_MODELS has at least one compound index whose
 *      first key is `tenantId`.
 *
 * In MT-0 the registry is empty, so this test trivially passes. The point is
 * to have it WIRED UP — the moment MT-1 adds the first model to TENANT_MODELS,
 * all three invariants are enforced. CI failure on this script is the signal
 * "you added a tenant-scoped model and missed a step".
 *
 * Run with: npm run test:multitenancy
 */

import mongoose from 'mongoose';

import {
  TENANT_MODELS,
  TENANT_SCOPE_PLUGIN_SYMBOL,
} from '../lib/tenancy/tenantModels';

// Side-effect import: register every model with Mongoose.
// We have to import them one-by-one because there is no barrel file.
import '../lib/models/User';
import '../lib/models/BusinessUnit';
import '../lib/models/Contact';
import '../lib/models/Lead';
import '../lib/models/Case';
import '../lib/models/CaseChecklist';
import '../lib/models/PipelineStage';
import '../lib/models/Task';
import '../lib/models/Document';
import '../lib/models/CalendarEvent';
import '../lib/models/SmartList';
import '../lib/models/Invoice';
import '../lib/models/Counter';
import '../lib/models/Settings';
import '../lib/models/AuditLog';
import '../lib/models/Tenant';

const errors: string[] = [];

function check(label: string, ok: boolean, detail: string): void {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label} — ${detail}`);
    errors.push(`${label}: ${detail}`);
  }
}

console.log('\nMT-0 multi-tenancy invariants\n');

// 1. Every model with a tenantId path is in TENANT_MODELS.
{
  const registered = new Set(TENANT_MODELS.map(({ model }) => model.modelName));
  const offenders: string[] = [];
  for (const [name, model] of Object.entries(mongoose.models)) {
    if (model.schema.path('tenantId') && !registered.has(name)) {
      offenders.push(name);
    }
  }
  check(
    'every model with `tenantId` is in TENANT_MODELS',
    offenders.length === 0,
    `offenders: ${offenders.join(', ') || '(none)'}`,
  );
}

// 2. Every model in TENANT_MODELS has tenantScopePlugin applied.
{
  const missing: string[] = [];
  for (const { model } of TENANT_MODELS) {
    const tagged = (model.schema as unknown as Record<symbol, unknown>)[
      TENANT_SCOPE_PLUGIN_SYMBOL
    ];
    if (!tagged) missing.push(model.modelName);
  }
  check(
    'every TENANT_MODELS entry has tenantScopePlugin applied',
    missing.length === 0,
    `missing plugin: ${missing.join(', ') || '(none)'}`,
  );
}

// 3. Every TENANT_MODELS entry has a tenant-first compound index.
{
  const offenders: string[] = [];
  for (const { model, label } of TENANT_MODELS) {
    // schema.indexes() returns [fields, options] tuples for compound indexes.
    const indexes = model.schema.indexes();
    const hasTenantFirst = indexes.some(([fields]) => {
      const firstKey = Object.keys(fields)[0];
      return firstKey === 'tenantId';
    });
    if (!hasTenantFirst) offenders.push(`${model.modelName} (${label})`);
  }
  check(
    'every TENANT_MODELS entry has a tenant-first compound index',
    offenders.length === 0,
    `offenders: ${offenders.join(', ') || '(none)'}`,
  );
}

console.log(
  `\n  ${errors.length === 0 ? '✓ all invariants hold' : `✗ ${errors.length} invariant(s) violated`}\n`,
);
process.exit(errors.length === 0 ? 0 : 1);
```

- [ ] **Step 3: Run it and expect green**

Run: `npm run test:multitenancy`
Expected: PASS — all three invariants trivially hold because TENANT_MODELS is empty.

Output should look like:
```
MT-0 multi-tenancy invariants

  ✓ every model with `tenantId` is in TENANT_MODELS
  ✓ every TENANT_MODELS entry has tenantScopePlugin applied
  ✓ every TENANT_MODELS entry has a tenant-first compound index

  ✓ all invariants hold
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: Both pass.

- [ ] **Step 5: Smoke-test invariant by deliberately violating it (and then reverting)**

This proves the test actually catches bad state. The user runs this verification themselves during the manual gate.

Temporary change: in `scripts/test-multitenancy-invariants.ts`, after the imports, add:

```ts
// TEMP: prove the invariant test bites. Revert before commit.
TENANT_MODELS.push({ model: mongoose.models.User, label: 'users' } as never);
```

Run: `npm run test:multitenancy`
Expected: FAIL — User is not tagged with the plugin AND has no tenant-first index AND has tenantId-less schema. At least two of the three checks should print `✗`.

Revert the temporary line.

Run: `npm run test:multitenancy` again.
Expected: PASS.

- [ ] **Step 6: Summarize and stop**

Summary to user:
> "Task 6 ready for review. CI invariant test wired up at `scripts/test-multitenancy-invariants.ts` + `test:multitenancy` npm script. Trivially passes in MT-0 (empty registry). Verified it actually bites by deliberately violating it then reverting."

**DO NOT commit.** Wait for the user.

---

## MT-0 Smoke Test (run before signing off MT-0)

Once Tasks 1–6 are done, the full MT-0 gate is:

```powershell
npm run typecheck
npm run lint
npm run test:plugins         # existing — confirms MT-0 didn't break Phase 0b
npm run test:tenant-scope    # new — confirms plugin + helper work
npm run test:multitenancy    # new — confirms invariants
npm run dev                  # boot, browse a few pages, confirm nothing visibly changed
```

All five must come back clean. The dev-server walkthrough is the proof of "no app behavior change" — sign in, look at the dashboard, leads, cases, settings. Everything should be identical to before MT-0.

## MT-0 Manual Gate Checklist

After the smoke test passes:

- [ ] Tenant model exists at `lib/models/Tenant.ts` with the four statuses, audit-logged, no soft-delete.
- [ ] `tenantScopePlugin` exists at `lib/db/tenantScopePlugin.ts` and refuses queries without `tenantId`.
- [ ] `tenantAggregate` exists at `lib/tenancy/tenantAggregate.ts` and prepends a `tenantId` `$match` stage.
- [ ] ESLint rule banning raw `.aggregate(` is in `eslint.config.mjs`; allow-list includes only the helper and the smoke test.
- [ ] `TENANT_MODELS` skeleton is at `lib/tenancy/tenantModels.ts` with the plugin symbol exported.
- [ ] CI invariant test is at `scripts/test-multitenancy-invariants.ts` and the npm script runs it.
- [ ] No existing route, page, or model behaves differently — confirmed by manual walkthrough.

When all of the above tick, MT-0 is done. Time to plan MT-1.

---

## Self-review notes

- **Spec coverage:** Every MT-0 deliverable from spec §8 has at least one task. Layer 1 → Task 2. Layer 3 (aggregate helper) → Task 3. Layer 3 (eslint) → Task 4. Layer 4 (CI test) → Task 6. Tenant model from §3.1 → Task 5. `TENANT_MODELS` from §6.1 → Task 1.
- **Placeholder scan:** No `TBD`/`TODO`-in-plan markers; every step contains the actual code or command.
- **Type consistency:** `TENANT_SCOPE_PLUGIN_SYMBOL`, `TENANT_MODELS`, `tenantScopePlugin`, `tenantAggregate` names used consistently across tasks 1, 2, 3, 6. `__crossTenant` option name matches between plugin and helper consumers.
- **Scope:** MT-0 only. Out-of-scope items explicitly listed in the File Map header.
- **Ambiguity:** The note in Task 3 about `.option({ __crossTenant: true })` being unnecessary on aggregations (because the plugin doesn't hook aggregate) is called out inline so the executor doesn't add a redundant option.
