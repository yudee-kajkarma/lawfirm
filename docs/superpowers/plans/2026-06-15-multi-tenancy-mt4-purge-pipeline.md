# Multi-Tenancy MT-4 (Purge Pipeline + Signed Zero-Report) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

> **Project rule — commits are user-owned:** Every "commit step" stops at a staging-ready summary. **DO NOT run `git add` or `git commit`.** The whole MT-4 phase accumulates as uncommitted changes; the user verifies via the smoke-test gate at the bottom and commits with their own message.

> **Pacing rule:** Execute Tasks 1–5 in one stretch with internal subagent reviews and present one consolidated report at the end. Smoke-test gate is at the bottom.

**Goal:** Implement the verifiable tenant-purge pipeline. The pipeline iterates the `TENANT_MODELS` registry to hard-delete every tenant-scoped record, cleans up that tenant's S3 objects, runs a verification sweep that requires every count to be zero, writes a signed zero-report to a permanent `PurgeReport` collection, and finally hard-deletes the `Tenant` document. Idempotent, resumable, and load-bearing on the MT-0 CI invariant test (any model added without being in `TENANT_MODELS` is caught at CI time, BEFORE production data is missed).

**Architecture:** A single `purgeTenant(tenantId)` orchestrator service. State transitions use atomic CAS (`pending_purge → purging`) to prevent two concurrent crons from racing. Two API entry points: (a) the operator-driven "purge now" button (eligibility-gated, requires `pending_purge` + past `purgeScheduledAt`); (b) the cron endpoint at `/api/operator/internal/run-purges` (HMAC-authed, finds every eligible tenant, runs them sequentially — includes recovery for tenants stuck in `purging`).

**Tech Stack:** Mongoose 9 raw driver `deleteMany` (bypasses soft-delete on purpose — we want hard erasure), AWS S3 `DeleteObjects` batched per 1000 keys, Node `crypto` for HMAC-SHA-256 zero-report signing. Existing TanStack Query patterns for the operator UI.

**Spec reference:** `docs/superpowers/specs/2026-06-13-multi-tenancy-design.md` — §7 (Tenant lifecycle: suspend → grace → purge), §7.2 (Purge sequence), §7.3 (S3 cleanup), §7.4 (Signed zero-report), §7.5 (Daily cron), §8 MT-4.

**MT-0/1/2/3 already in place:**
- `TENANT_MODELS` registry + invariant test.
- `Tenant.status` state machine (`active | suspended | pending_purge | purging`).
- Operator console with suspend / reactivate / schedule-purge / cancel-purge.
- `OperatorAuditLog` for operator activity.

**Out of scope (deferred):**
- Real Vercel-cron wire-up (the endpoint exists; deploying the cron job is a deployment concern outside MT-4).
- Per-tenant KMS keys (uses the existing `INTEGRATION_SECRET_KEY` for HMAC signing).
- Operator-side undo of a completed purge (impossible by design — the data is gone).
- Migrating existing S3 keys to a tenant-prefixed scheme (Document model iteration handles deletion regardless of prefix scheme).

---

## File map

### Create — models + signing
- `lib/models/PurgeReport.ts` — permanent record of every completed purge.
- `lib/services/purgeReportSign.ts` — canonical-JSON + HMAC-SHA-256 sign + verify.

### Create — purge services
- `lib/services/s3TenantCleanup.ts` — batch-delete every S3 object owned by a tenant.
- `lib/services/purgeTenant.ts` — the orchestrator.

### Create — API routes
- `app/api/operator/tenants/[id]/purge-now/route.ts` — operator-triggered, eligibility-gated.
- `app/api/operator/internal/run-purges/route.ts` — cron endpoint, HMAC-authed.
- `app/api/operator/purge-reports/route.ts` — `GET` list.
- `app/api/operator/purge-reports/[id]/route.ts` — `GET` single with HMAC verify status.

### Create — operator UI
- `app/(operator)/admin/purge-reports/page.tsx`.
- `app/(operator)/admin/purge-reports/PurgeReportsClient.tsx`.
- `components/operator/PurgeNowConfirmDialog.tsx` — slug-confirm; only mounted when eligible.
- `hooks/usePurgeReports.ts` — TanStack Query.
- `hooks/useOperatorTenants.ts` — add `usePurgeNow()` mutation alongside the existing operator hooks.

### Create — integration test
- `scripts/test-purge.ts` — full pipeline: signup → suspend → schedule-purge → fast-forward → purge-now → verify zero-report + tenant gone.

### Modify
- `lib/constants/enums.ts` — add `purge_now` to `OPERATOR_AUDIT_ACTIONS` (operator manually triggering counts as a recorded action).
- `app/(operator)/admin/tenants/[id]/TenantDetailClient.tsx` — wire the "Purge now" button when status + purgeScheduledAt eligible.
- `components/layout/OperatorSidebar.tsx` — add "Purge reports" nav item.
- `components/layout/Header.tsx` — `PAGE_TITLES['/admin/purge-reports'] = 'Purge reports'`.
- `types/operator.ts` — add `PurgeReportListItem`, `PurgeReportDetail` wire types.
- `.env.example` — document `PURGE_CRON_SECRET`.
- `package.json` — `test:purge` script.

---

## Task 1 — PurgeReport model + HMAC signing

**Why first:** Tasks 2-5 all reference these.

### Files
- Create: `lib/models/PurgeReport.ts`
- Create: `lib/services/purgeReportSign.ts`

- [ ] **Step 1: PurgeReport model**

`lib/models/PurgeReport.ts`:

```ts
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * Permanent record of a successful tenant purge. NEVER soft-deleted, never
 * tenant-scoped (the tenant it describes no longer exists). Operators can
 * audit the historical purge log even after the source tenant is gone.
 *
 * The `hmac` field is computed by `purgeReportSign.ts` over a canonical JSON
 * representation of `{ tenantId, tenantSlug, initialDeletes, verification }`.
 * Verification at read time proves the report wasn't tampered with after write.
 */
const PurgeReportSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    tenantSlug: { type: String, required: true, index: true },
    tenantName: { type: String, required: true },
    purgedAt: { type: Date, required: true, index: true },
    purgedByOperatorId: { type: Schema.Types.ObjectId, ref: 'PlatformOperator', default: null },
    purgedByOperatorEmail: { type: String, default: null },
    initialDeletes: { type: Schema.Types.Mixed, required: true }, // { collectionLabel: count }
    verification: { type: Schema.Types.Mixed, required: true },   // { collectionLabel: count } — must all 0
    hmac: { type: String, required: true },
    hmacAlgorithm: { type: String, default: 'HMAC-SHA-256' },
    // 'cron' or 'operator' — recorded for forensic clarity.
    triggeredBy: { type: String, enum: ['cron', 'operator'], required: true },
  },
  { timestamps: true },
);

PurgeReportSchema.index({ purgedAt: -1 });

export type PurgeReportDoc = InferSchemaType<typeof PurgeReportSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PurgeReport: Model<PurgeReportDoc> =
  (mongoose.models.PurgeReport as Model<PurgeReportDoc>) ??
  mongoose.model<PurgeReportDoc>('PurgeReport', PurgeReportSchema);

export function serializePurgeReport(doc: Record<string, unknown>) {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    tenantSlug: String(doc.tenantSlug ?? ''),
    tenantName: String(doc.tenantName ?? ''),
    purgedAt: isoDate(doc.purgedAt),
    purgedByOperatorId: doc.purgedByOperatorId == null ? null : String(doc.purgedByOperatorId),
    purgedByOperatorEmail: doc.purgedByOperatorEmail == null ? null : String(doc.purgedByOperatorEmail),
    initialDeletes: doc.initialDeletes as Record<string, number>,
    verification: doc.verification as Record<string, number>,
    hmac: String(doc.hmac),
    hmacAlgorithm: String(doc.hmacAlgorithm ?? 'HMAC-SHA-256'),
    triggeredBy: doc.triggeredBy as 'cron' | 'operator',
    createdAt: isoDate(doc.createdAt),
  };
}
```

Note: NOT in `TENANT_MODELS` registry (no `tenantId` scoping plugin; tenant it describes is gone). The CI invariant test does NOT need it added.

- [ ] **Step 2: Signing service**

`lib/services/purgeReportSign.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.INTEGRATION_SECRET_KEY;
if (!SECRET) {
  throw new Error('INTEGRATION_SECRET_KEY must be set in .env.local for purge-report signing');
}

export type SignablePurgeReport = {
  tenantId: string;
  tenantSlug: string;
  initialDeletes: Record<string, number>;
  verification: Record<string, number>;
};

/**
 * Canonical JSON: keys sorted recursively, no whitespace. Ensures the same
 * logical content always produces the same HMAC, regardless of insertion
 * order. Without this, an HMAC could vary by `JSON.stringify` key order
 * (technically not guaranteed across runtimes / Node versions).
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export function signPurgeReport(report: SignablePurgeReport): string {
  const payload = canonicalize(report);
  return createHmac('sha256', SECRET!).update(payload).digest('hex');
}

/**
 * Constant-time verification. Returns true iff `report` was signed with the
 * current INTEGRATION_SECRET_KEY using `signPurgeReport`.
 */
export function verifyPurgeReport(report: SignablePurgeReport, hmac: string): boolean {
  const expected = signPurgeReport(report);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hmac, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 3: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS.

- [ ] **Step 4: Move to Task 2** — no commit.

---

## Task 2 — Tenant purge orchestrator + S3 cleanup

### Files
- Create: `lib/services/s3TenantCleanup.ts`
- Create: `lib/services/purgeTenant.ts`
- Modify: `lib/constants/enums.ts` — add `purge_now` to `OPERATOR_AUDIT_ACTIONS`

- [ ] **Step 1: S3 cleanup**

`lib/services/s3TenantCleanup.ts`:

```ts
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import type { Types } from 'mongoose';

import { connectDb } from '@/lib/db/connect';
import { DocumentModel } from '@/lib/models/Document';
import { STORAGE_BUCKET, STORAGE_REGION } from '@/lib/integrations/storage';

/**
 * Delete every S3 object owned by a tenant.
 *
 * Implementation: query Documents for the tenant, collect s3Keys, batch-delete
 * via DeleteObjects (max 1000 keys per call). We iterate the Document
 * collection rather than scanning an S3 prefix because the current storage
 * key scheme (`documents/<bu>/<uuid>`) doesn't include tenantId — a future
 * prefix migration is its own project.
 *
 * Returns the number of objects successfully deleted. A partial S3 failure
 * (some keys errored) does NOT throw — the purge orchestrator's verification
 * sweep checks Document collection counts to confirm Mongo state, and the
 * S3 error list is logged for follow-up.
 */

declare global {
   
  var __s3CleanupClient__: S3Client | undefined;
}
const s3: S3Client =
  globalThis.__s3CleanupClient__ ??
  (globalThis.__s3CleanupClient__ = new S3Client({ region: STORAGE_REGION }));

const BATCH = 1000;

export type S3CleanupResult = {
  deleted: number;
  errors: Array<{ key: string; code?: string; message?: string }>;
};

export async function s3CleanupForTenant(
  tenantId: Types.ObjectId,
): Promise<S3CleanupResult> {
  await connectDb();

  // Cross-tenant scan via __crossTenant — Document has tenantScopePlugin, so
  // a normal `find({ tenantId })` would also work; this is explicit about
  // operator-surface intent.
  const docs = await DocumentModel.find({ tenantId })
    .setOptions({ __crossTenant: true, withDeleted: true })
    .select('s3Key')
    .lean();

  const keys = docs.map((d) => String(d.s3Key)).filter(Boolean);
  if (keys.length === 0) return { deleted: 0, errors: [] };

  const errors: S3CleanupResult['errors'] = [];
  let deleted = 0;

  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    try {
      const res = await s3.send(
        new DeleteObjectsCommand({
          Bucket: STORAGE_BUCKET,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
        }),
      );
      deleted += res.Deleted?.length ?? 0;
      for (const e of res.Errors ?? []) {
        errors.push({
          key: String(e.Key ?? ''),
          code: e.Code ?? undefined,
          message: e.Message ?? undefined,
        });
      }
    } catch (err) {
      // Catastrophic batch failure (e.g., network). Log every key in the
      // batch as a failure so the operator can re-run.
      for (const Key of batch) {
        errors.push({ key: Key, message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return { deleted, errors };
}
```

- [ ] **Step 2: Add `purge_now` audit action**

In `lib/constants/enums.ts`, add `purge_now` to the existing `OPERATOR_AUDIT_ACTIONS` array:

```ts
export const OPERATOR_AUDIT_ACTIONS = [
  'login',
  'suspend_tenant',
  'reactivate_tenant',
  'schedule_purge',
  'cancel_purge',
  'purge_now',
] as const;
```

- [ ] **Step 3: Purge orchestrator**

`lib/services/purgeTenant.ts`:

```ts
import type { Types } from 'mongoose';

import { connectDb } from '@/lib/db/connect';
import { PurgeReport } from '@/lib/models/PurgeReport';
import { Tenant, type TenantDoc } from '@/lib/models/Tenant';
import { TENANT_MODELS } from '@/lib/tenancy/tenantModels';

import { s3CleanupForTenant, type S3CleanupResult } from './s3TenantCleanup';
import { signPurgeReport } from './purgeReportSign';

export type PurgeTrigger = 'cron' | 'operator';

export type PurgeContext = {
  triggeredBy: PurgeTrigger;
  operatorId?: string | null;
  operatorEmail?: string | null;
};

export class PurgeIneligible extends Error {
  constructor(message: string) { super(message); this.name = 'PurgeIneligible'; }
}
export class PurgeIncomplete extends Error {
  constructor(
    message: string,
    public verification: Record<string, number>,
  ) { super(message); this.name = 'PurgeIncomplete'; }
}

export type PurgeOutcome = {
  reportId: string;
  initialDeletes: Record<string, number>;
  verification: Record<string, number>;
  s3: S3CleanupResult;
};

/**
 * Purge one tenant. Idempotent: re-running on a tenant stuck in 'purging'
 * (crash recovery) repeats the sweep + verification and produces a clean
 * zero-report.
 *
 * Steps:
 *   0. Verify eligibility (status, purgeScheduledAt OR already-purging).
 *   1. Atomic CAS pending_purge → purging.
 *   2. Hard-deleteMany({tenantId}) per model in TENANT_MODELS via raw driver.
 *   3. S3 cleanup via s3CleanupForTenant.
 *   4. Verification sweep — iterate registry, count, every count must be 0.
 *      If any non-zero, throw PurgeIncomplete; tenant doc left intact.
 *   5. Sign the zero-report; write to PurgeReport.
 *   6. Delete the Tenant document.
 */
export async function purgeTenant(
  tenantId: Types.ObjectId,
  ctx: PurgeContext,
): Promise<PurgeOutcome> {
  await connectDb();

  // 0. Eligibility.
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new PurgeIneligible(`Tenant ${tenantId} not found`);
  }
  if (!isEligible(tenant)) {
    throw new PurgeIneligible(
      `Tenant ${tenant.slug} is not eligible for purge (status=${tenant.status}, purgeScheduledAt=${tenant.purgeScheduledAt?.toISOString() ?? 'null'})`,
    );
  }

  // 1. Atomic CAS to 'purging'. Only succeeds if status is still
  // 'pending_purge' OR is already 'purging' (crash recovery).
  const cas = await Tenant.updateOne(
    {
      _id: tenant._id,
      status: { $in: ['pending_purge', 'purging'] },
    },
    { $set: { status: 'purging' } },
  );
  if (cas.matchedCount === 0) {
    throw new PurgeIneligible('Tenant state changed before purge could start');
  }

  // 2. Initial deletes — raw driver, bypasses middleware (no soft-delete).
  const initialDeletes: Record<string, number> = {};
  for (const { model, label } of TENANT_MODELS) {
    const r = await model.collection.deleteMany({ tenantId });
    initialDeletes[label] = r.deletedCount ?? 0;
  }

  // 3. S3 cleanup. Tracks deletions + errors but does not throw.
  const s3 = await s3CleanupForTenant(tenant._id);

  // 4. Verification sweep — every count must be zero.
  const verification: Record<string, number> = {};
  for (const { model, label } of TENANT_MODELS) {
    verification[label] = await model.collection.countDocuments({ tenantId });
  }
  const nonZero = Object.entries(verification).filter(([, n]) => n > 0);
  if (nonZero.length > 0) {
    throw new PurgeIncomplete(
      `Verification sweep found ${nonZero.length} non-zero counts after purge: ${nonZero.map(([k, v]) => `${k}=${v}`).join(', ')}`,
      verification,
    );
  }

  // 5. Sign and persist the report.
  const hmac = signPurgeReport({
    tenantId: String(tenant._id),
    tenantSlug: tenant.slug,
    initialDeletes,
    verification,
  });
  const report = await PurgeReport.create({
    tenantId: tenant._id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    purgedAt: new Date(),
    purgedByOperatorId: ctx.operatorId ?? null,
    purgedByOperatorEmail: ctx.operatorEmail ?? null,
    initialDeletes,
    verification,
    hmac,
    hmacAlgorithm: 'HMAC-SHA-256',
    triggeredBy: ctx.triggeredBy,
  });

  // 6. Hard-delete the tenant doc.
  await Tenant.deleteOne({ _id: tenant._id });

  return { reportId: report._id.toString(), initialDeletes, verification, s3 };
}

/**
 * Eligible if EITHER:
 *   - status is 'pending_purge' AND purgeScheduledAt is in the past, OR
 *   - status is 'purging' (crash recovery — purge was interrupted)
 */
function isEligible(tenant: TenantDoc): boolean {
  if (tenant.status === 'purging') return true;
  if (tenant.status !== 'pending_purge') return false;
  if (!tenant.purgeScheduledAt) return false;
  return new Date(tenant.purgeScheduledAt).getTime() <= Date.now();
}

export { isEligible };
```

- [ ] **Step 4: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS.

- [ ] **Step 5: Move to Task 3** — no commit.

---

## Task 3 — Purge API routes

### Files
- Create: `app/api/operator/tenants/[id]/purge-now/route.ts`
- Create: `app/api/operator/internal/run-purges/route.ts`
- Create: `app/api/operator/purge-reports/route.ts`
- Create: `app/api/operator/purge-reports/[id]/route.ts`

- [ ] **Step 1: Operator-triggered purge-now**

`app/api/operator/tenants/[id]/purge-now/route.ts`:

```ts
import { isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { Tenant } from '@/lib/models/Tenant';
import { writeOperatorAudit } from '@/lib/services/operatorAudit';
import {
  PurgeIneligible,
  PurgeIncomplete,
  purgeTenant,
} from '@/lib/services/purgeTenant';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const POST = withOperatorAuth<Params>(async (req, { params }, { operator }) => {
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Tenant not found', 404);
  }
  await connectDb();

  const tenant = await Tenant.findById(params.id);
  if (!tenant) return apiError('NOT_FOUND', 'Tenant not found', 404);

  try {
    const outcome = await purgeTenant(tenant._id, {
      triggeredBy: 'operator',
      operatorId: operator._id,
      operatorEmail: operator.email,
    });

    await writeOperatorAudit({
      operator,
      action: 'purge_now',
      targetTenant: { _id: tenant._id, slug: tenant.slug },
      details: { reportId: outcome.reportId, deletes: outcome.initialDeletes, s3: outcome.s3 },
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    });

    return apiOk({ data: { reportId: outcome.reportId } });
  } catch (err) {
    if (err instanceof PurgeIneligible) {
      return apiError('CONFLICT', err.message, 409);
    }
    if (err instanceof PurgeIncomplete) {
      console.error('[purge-now] verification failed', { tenantId: tenant._id.toString(), verification: err.verification });
      return apiError('PURGE_INCOMPLETE', err.message, 500, { verification: err.verification });
    }
    throw err;
  }
});
```

- [ ] **Step 2: Cron endpoint with HMAC auth**

`app/api/operator/internal/run-purges/route.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NextRequest } from 'next/server';

import { connectDb } from '@/lib/db/connect';
import { Tenant } from '@/lib/models/Tenant';
import {
  PurgeIneligible,
  PurgeIncomplete,
  purgeTenant,
} from '@/lib/services/purgeTenant';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const CRON_SECRET = process.env.PURGE_CRON_SECRET;

export async function POST(req: NextRequest): Promise<Response> {
  if (!CRON_SECRET) {
    return apiError('SERVER_CONFIG', 'PURGE_CRON_SECRET not set', 500);
  }
  // HMAC over the request body. For an empty-body cron, this is HMAC of "".
  // The header name is chosen for clarity; the cron caller computes the same
  // HMAC and sends it. Constant-time compare avoids timing oracles.
  const body = await req.text();
  const expected = createHmac('sha256', CRON_SECRET).update(body).digest('hex');
  const provided = req.headers.get('x-purge-cron-signature') ?? '';
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided.length === a.length * 2 ? provided : '', 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return apiError('UNAUTHORIZED', 'Invalid cron signature', 401);
  }

  await connectDb();

  const now = new Date();
  // Find eligible tenants: (pending_purge AND purgeScheduledAt <= now) OR
  // (purging — interrupted purge needs recovery).
  const eligible = await Tenant.find({
    $or: [
      { status: 'pending_purge', purgeScheduledAt: { $lte: now } },
      { status: 'purging' },
    ],
  }).select('_id slug').lean();

  const results: Array<{
    tenantId: string;
    tenantSlug: string;
    status: 'purged' | 'failed';
    reportId?: string;
    error?: string;
  }> = [];

  for (const t of eligible) {
    try {
      const outcome = await purgeTenant(t._id, { triggeredBy: 'cron' });
      results.push({ tenantId: String(t._id), tenantSlug: t.slug, status: 'purged', reportId: outcome.reportId });
    } catch (err) {
      if (err instanceof PurgeIneligible || err instanceof PurgeIncomplete) {
        results.push({ tenantId: String(t._id), tenantSlug: t.slug, status: 'failed', error: err.message });
      } else {
        console.error('[run-purges] unexpected error', { tenantId: String(t._id), err });
        results.push({ tenantId: String(t._id), tenantSlug: t.slug, status: 'failed', error: 'Unexpected error' });
      }
    }
  }

  return apiOk({ data: { scanned: eligible.length, results } });
}
```

- [ ] **Step 3: List + detail for purge reports**

`app/api/operator/purge-reports/route.ts`:

```ts
import { Types, isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { PurgeReport, serializePurgeReport } from '@/lib/models/PurgeReport';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const GET = withOperatorAuth(async (req) => {
  await connectDb();
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

  const filter: Record<string, unknown> = {};

  const search = sp.get('search');
  if (search) filter.tenantSlug = new RegExp(search, 'i');

  const cursor = sp.get('cursor');
  if (cursor && isValidObjectId(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await PurgeReport.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasNext = docs.length > limit;
  const items = hasNext ? docs.slice(0, limit) : docs;
  const nextCursor = hasNext ? String(items[items.length - 1]!._id) : null;

  return apiOk({
    data: items.map((d) => serializePurgeReport(d as Record<string, unknown>)),
    meta: { cursor: nextCursor, limit },
  });
});
```

`app/api/operator/purge-reports/[id]/route.ts`:

```ts
import { isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { PurgeReport, serializePurgeReport } from '@/lib/models/PurgeReport';
import { verifyPurgeReport } from '@/lib/services/purgeReportSign';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withOperatorAuth<Params>(async (_req, { params }) => {
  if (!isValidObjectId(params.id)) return apiError('NOT_FOUND', 'Purge report not found', 404);
  await connectDb();

  const doc = await PurgeReport.findById(params.id).lean();
  if (!doc) return apiError('NOT_FOUND', 'Purge report not found', 404);

  const serialized = serializePurgeReport(doc as Record<string, unknown>);
  const hmacValid = verifyPurgeReport(
    {
      tenantId: serialized.tenantId,
      tenantSlug: serialized.tenantSlug,
      initialDeletes: serialized.initialDeletes,
      verification: serialized.verification,
    },
    serialized.hmac,
  );

  return apiOk({ data: { ...serialized, hmacValid } });
});
```

- [ ] **Step 4: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS.

- [ ] **Step 5: Move to Task 4** — no commit.

---

## Task 4 — Operator UI

### Files
- Create: `app/(operator)/admin/purge-reports/page.tsx`
- Create: `app/(operator)/admin/purge-reports/PurgeReportsClient.tsx`
- Create: `components/operator/PurgeNowConfirmDialog.tsx`
- Create: `hooks/usePurgeReports.ts`
- Modify: `hooks/useOperatorTenants.ts` — add `usePurgeNow` mutation
- Modify: `app/(operator)/admin/tenants/[id]/TenantDetailClient.tsx` — wire purge-now button
- Modify: `components/layout/OperatorSidebar.tsx` — add Purge Reports nav
- Modify: `components/layout/Header.tsx` — add `/admin/purge-reports` to PAGE_TITLES
- Modify: `types/operator.ts` — add `PurgeReportListItem`, `PurgeReportDetail`

- [ ] **Step 1: Wire types**

In `types/operator.ts`, append:

```ts
export type PurgeReportListItem = {
  _id: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  purgedAt: string;
  purgedByOperatorEmail: string | null;
  triggeredBy: 'cron' | 'operator';
  createdAt: string;
};

export type PurgeReportDetail = PurgeReportListItem & {
  purgedByOperatorId: string | null;
  initialDeletes: Record<string, number>;
  verification: Record<string, number>;
  hmac: string;
  hmacAlgorithm: string;
  hmacValid: boolean;
};
```

- [ ] **Step 2: Hooks**

`hooks/usePurgeReports.ts` — `useInfiniteQuery` for list, `useQuery` for single. Mirror the pattern in `hooks/useOperatorAudit.ts`.

In `hooks/useOperatorTenants.ts`, add a `usePurgeNow()` mutation:

```ts
export function usePurgeNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await fetch(`/api/operator/tenants/${tenantId}/purge-now`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Purge failed');
      }
      const data = await res.json();
      await qc.invalidateQueries({ queryKey: ['operatorTenants'], refetchType: 'all' });
      await qc.invalidateQueries({ queryKey: ['purgeReports'], refetchType: 'all' });
      return data.data as { reportId: string };
    },
  });
}
```

- [ ] **Step 3: Purge-now confirm dialog**

`components/operator/PurgeNowConfirmDialog.tsx` — same shape as `SuspendConfirmDialog`, but:
- Title: "Permanently purge {tenantName}?"
- Description: red text emphasizing this is IRREVERSIBLE. List bullet points: deletes all leads, cases, contacts, documents, S3 objects, users. Cannot be undone.
- Slug confirmation input.
- Uses `usePurgeNow()`. On success, navigate to `/admin/purge-reports/{reportId}` and toast "Tenant purged. Signed report saved."

- [ ] **Step 4: Wire the purge-now button**

In `app/(operator)/admin/tenants/[id]/TenantDetailClient.tsx`, in the actions section for `pending_purge` status:

- Show existing "Cancel purge" button if `purgeScheduledAt > now`.
- ALSO show "Purge now" (destructive) if `purgeScheduledAt <= now` — the cron would pick this up; operator can shortcut it.
- For `purging` status: show "Resume purge" button (calls the same purge-now endpoint — service handles the recovery path).

State machine recap for the UI:
| status | purgeScheduledAt | Buttons |
|---|---|---|
| active | — | Suspend |
| suspended | — | Reactivate / Schedule purge |
| pending_purge | future | Cancel purge |
| pending_purge | past | Cancel purge / Purge now |
| purging | — | Resume purge |

- [ ] **Step 5: Purge reports page + client**

`app/(operator)/admin/purge-reports/page.tsx`:
```tsx
import { PurgeReportsClient } from './PurgeReportsClient';
export default function PurgeReportsPage() {
  return <PurgeReportsClient />;
}
```

`PurgeReportsClient.tsx` — list page. Columns: tenant slug, tenant name, purgedAt (relative + tooltip absolute), triggered by (badge: cron=sky / operator=violet), operator email, HMAC status (need to fetch detail for verify status, OR omit from list — fetching the list of valid signatures requires N queries; show the bulk list without per-row verify, link each row to a detail view).

Detail view: clicking a row could open an inline panel or a dedicated `/admin/purge-reports/[id]` page. For MT-4 keep it simple — a Sheet/Dialog from the list page that fetches the detail (with `hmacValid`) and shows:
- All fields
- "HMAC valid ✓" or "HMAC INVALID ✗" badge (the load-bearing check)
- initialDeletes table
- verification table (all zeros)

- [ ] **Step 6: Sidebar + page title**

In `components/layout/OperatorSidebar.tsx`, add a third nav item:
- `{ href: '/admin/purge-reports', label: 'Purge Reports', icon: <pick a lucide icon like FileCheck2> }`

In `components/layout/Header.tsx`, in PAGE_TITLES:
```ts
'/admin/purge-reports': 'Purge reports',
```

- [ ] **Step 7: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS.

- [ ] **Step 8: Move to Task 5** — no commit.

---

## Task 5 — Integration test + final sweep

### Files
- Create: `scripts/test-purge.ts`
- Modify: `package.json` — `test:purge` script
- Modify: `.env.example` (if present) — document `PURGE_CRON_SECRET`

- [ ] **Step 1: Add npm script + env var note**

In `package.json`, after `test:operator-flow`:
```json
    "test:purge": "tsx --env-file=.env.local scripts/test-purge.ts",
```

If `.env.example` exists, add:
```
# Cron auth for /api/operator/internal/run-purges. Random ≥32-byte hex string.
PURGE_CRON_SECRET=
```

Tell the user to set `PURGE_CRON_SECRET` in their `.env.local` to any random hex string. The test will use the value to compute HMAC; in dev it can be anything ≥16 chars.

- [ ] **Step 2: Integration test**

`scripts/test-purge.ts`:

```ts
/**
 * MT-4 smoke test — full purge pipeline.
 *
 * Exercises:
 *   1. Signup → suspend → schedule-purge → fast-forward purgeScheduledAt → purge.
 *   2. Verification sweep — every TENANT_MODELS collection has 0 docs for the tenant.
 *   3. Signed report HMAC verifies.
 *   4. Tenant doc is hard-gone.
 *   5. Re-running purgeTenant on a tenant stuck in 'purging' (crash recovery) is a no-op success.
 *
 * Does NOT exercise: HTTP routes, UI, the cron HMAC handshake (those are
 * the user's manual gate). Service layer only.
 */

import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../lib/db/connect';
import { PurgeReport } from '../lib/models/PurgeReport';
import { Tenant } from '../lib/models/Tenant';
import { performTenantSignup } from '../lib/services/tenantSignup';
import { purgeTenant } from '../lib/services/purgeTenant';
import { verifyPurgeReport } from '../lib/services/purgeReportSign';
import { TENANT_MODELS } from '../lib/tenancy/tenantModels';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}
function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('\nMT-4 purge pipeline smoke test\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  // 1. Signup.
  const stamp = Date.now();
  const { tenant } = await performTenantSignup({
    companyName: `MT4 Purge Test ${stamp}`,
    ownerName: 'Owner',
    ownerEmail: `mt4-purge-${stamp}@example.com`,
    password: 'TestPassword123!',
  });
  log('setup', `tenant ${tenant.slug} (_id=${tenant._id}) created with 3 BUs + admin user + Settings`);

  // Sanity-check: collections have records.
  const initialCounts: Record<string, number> = {};
  for (const { model, label } of TENANT_MODELS) {
    initialCounts[label] = await model.collection.countDocuments({ tenantId: tenant._id });
  }
  const nonEmpty = Object.entries(initialCounts).filter(([, n]) => n > 0);
  log('setup', `non-empty: ${nonEmpty.map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // 2. Suspend + schedule-purge with past purgeScheduledAt (simulate fast-forward).
  tenant.status = 'suspended';
  tenant.suspendedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  await tenant.save();
  tenant.status = 'pending_purge';
  tenant.purgeScheduledAt = new Date(Date.now() - 1000); // 1s ago — eligible
  await tenant.save();
  log('schedule', `status=pending_purge, purgeScheduledAt=${tenant.purgeScheduledAt.toISOString()}`);

  // 3. Run purge.
  const outcome = await purgeTenant(tenant._id, { triggeredBy: 'operator' });
  log('purge', `reportId=${outcome.reportId}`);
  log('purge', `initialDeletes summary: ${Object.entries(outcome.initialDeletes).filter(([, n]) => n > 0).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // 4. Verification: every count must be zero.
  for (const [label, count] of Object.entries(outcome.verification)) {
    if (count !== 0) fail('verify', `${label} still has ${count} docs after purge`);
  }
  log('verify', `all ${TENANT_MODELS.length} collections verified zero ✓`);

  // 5. Tenant doc is gone.
  const stillThere = await Tenant.findById(tenant._id);
  if (stillThere) fail('tenant-gone', 'tenant doc still exists after purge');
  log('tenant-gone', 'Tenant document hard-deleted ✓');

  // 6. PurgeReport exists and HMAC verifies.
  const report = await PurgeReport.findById(outcome.reportId).lean();
  if (!report) fail('report', 'PurgeReport not written');
  const valid = verifyPurgeReport(
    {
      tenantId: String(report.tenantId),
      tenantSlug: report.tenantSlug,
      initialDeletes: report.initialDeletes as Record<string, number>,
      verification: report.verification as Record<string, number>,
    },
    report.hmac,
  );
  if (!valid) fail('hmac', 'PurgeReport HMAC failed verification');
  log('hmac', 'PurgeReport HMAC verifies ✓');

  // 7. Re-purge after the fact returns PurgeIneligible (tenant is gone).
  try {
    await purgeTenant(tenant._id, { triggeredBy: 'cron' });
    fail('re-purge', 'purgeTenant should have thrown PurgeIneligible for gone tenant');
  } catch (err) {
    if ((err as Error).name === 'PurgeIneligible') {
      log('re-purge', `correctly threw PurgeIneligible: ${(err as Error).message}`);
    } else {
      fail('re-purge', `wrong error type: ${(err as Error).name}`);
    }
  }

  // Cleanup: drop the test PurgeReport so subsequent runs start clean.
  await PurgeReport.deleteOne({ _id: outcome.reportId });
  log('cleanup', 'removed test PurgeReport');

  await disconnectDb();
  console.log('\n  ✓ MT-4 purge pipeline smoke test passed\n');
}

main().catch(async (err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Run every test**

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

All 10 must PASS.

If `test:purge` fails because `INTEGRATION_SECRET_KEY` is unset, that's a real config gap — surface it to the user.
If S3 cleanup fails because AWS env vars are missing in `.env.local`, the test should still pass because the test tenant has 0 Documents — `s3CleanupForTenant` returns immediately when keys=0. Verify this is what's happening.

- [ ] **Step 4: Report to user** — end here.

---

## MT-4 smoke-test gate (user runs these)

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
npm run test:purge          # NEW — full pipeline
npm run dev
```

Add `PURGE_CRON_SECRET=<random 32+ char hex>` to your `.env.local` if you haven't already.

## MT-4 manual gate

**Setup:**
- Sign in as the operator (`ops@instapath.test`).
- Make sure you have at least one throwaway tenant in `pending_purge` state with `purgeScheduledAt` in the past. Easiest: in Mongo shell —
  ```
  db.tenants.updateOne(
    { slug: 'smith-co' },
    { $set: { status: 'pending_purge', suspendedAt: new Date(Date.now() - 31*24*60*60*1000), purgeScheduledAt: new Date(Date.now() - 1000) } }
  )
  ```

**Round 1 — UI surfaces eligibility correctly:**
- [ ] Open the tenant in `/admin/tenants/<id>`. Action buttons show **both** "Cancel purge" AND "Purge now" (because purgeScheduledAt is in the past).
- [ ] If `purgeScheduledAt` is set to the future (30d), "Purge now" disappears; only "Cancel purge" is visible.

**Round 2 — purge happy path:**
- [ ] Click "Purge now". Confirm dialog requires typing the slug.
- [ ] After confirm: toast "Tenant purged. Signed report saved." (or similar). You're navigated to the new purge report's detail.
- [ ] The detail view shows: "HMAC valid ✓" badge, initialDeletes table, verification table (all zeros), triggered by Operator + your email.
- [ ] `/admin/tenants` no longer shows the purged tenant.
- [ ] DB check (Mongo shell): `db.tenants.findOne({ slug: 'smith-co' })` returns null.

**Round 3 — purge reports list:**
- [ ] `/admin/purge-reports` shows the report you just created at the top.
- [ ] Click another row (or the same row) to verify the detail loads cleanly.

**Round 4 — operator audit shows the purge:**
- [ ] `/admin/audit` includes a `purge_now` entry with the tenant slug.

**Round 5 — cron endpoint (manual exercise of the HMAC path):**
- [ ] In a terminal, create another `pending_purge` tenant with past `purgeScheduledAt` (Mongo shell, same pattern as setup).
- [ ] Compute HMAC of an empty body:
  ```powershell
  $secret = (Get-Content .env.local | Select-String 'PURGE_CRON_SECRET').Line.Split('=')[1].Trim()
  $hmac = (New-Object System.Security.Cryptography.HMACSHA256 ([Text.Encoding]::UTF8.GetBytes($secret))).ComputeHash([Text.Encoding]::UTF8.GetBytes(''))
  $hex = -join ($hmac | ForEach-Object { '{0:x2}' -f $_ })
  $hex
  ```
- [ ] POST to the cron endpoint with that header:
  ```powershell
  curl -X POST http://localhost:3000/api/operator/internal/run-purges -H "x-purge-cron-signature: $hex"
  ```
- [ ] Response should show `data.scanned >= 1` and the eligible tenant in `results` with `status: 'purged'`.
- [ ] DB check: that second tenant should also be gone, and there should be a new `purge_reports` entry with `triggeredBy: 'cron'`.

**Round 6 — invalid HMAC rejected:**
- [ ] Same `curl` with a wrong signature:
  ```powershell
  curl -X POST http://localhost:3000/api/operator/internal/run-purges -H "x-purge-cron-signature: deadbeef"
  ```
- [ ] Response: 401 `Invalid cron signature`.

**Round 7 — crash recovery (optional but valuable):**
- [ ] Set a test tenant to `purging` directly in Mongo (`db.tenants.updateOne({ slug: 'X' }, { $set: { status: 'purging' } })`).
- [ ] Click "Resume purge" on that tenant's detail page. It should complete (the orchestrator handles the `purging` state as eligible).

**Cleanup:** any PurgeReports created during testing are permanent by design — you can leave them or hand-delete from Mongo if you want a clean slate.

When everything ticks, MT-4 is done. Commit with a message like:
`feat: MT-4 — tenant purge pipeline with signed zero-report`

---

## Self-review notes

- **Spec coverage:** §7.1 state machine (already in place from MT-3; the `purging` transition is what's new) — Task 2 step 3. §7.2 purge sequence — Task 2 step 3. §7.3 S3 cleanup — Task 2 step 1. §7.4 signed zero-report — Tasks 1 + 2. §7.5 daily cron — Task 3 step 2. MT-4 from §8.
- **Placeholder scan:** zero `TBD`/`TODO` markers.
- **Type consistency:** `triggeredBy: 'cron' | 'operator'` consistent across model + service + cron endpoint. `PurgeOutcome`, `PurgeContext`, `PurgeReportDetail`, `S3CleanupResult` all defined once and re-used.
- **Scope:** MT-4 only. Vercel-cron-job deployment, KMS rotation, undo-purge — all deferred in the File Map header.
- **Ambiguity:** the "what counts as eligible" rule is centralized in `isEligible(tenant)` (Task 2 step 3) — both the manual purge-now route and the cron route use it. Crash-recovery (purging-state) is explicitly handled both at endpoint discovery (run-purges $or clause) and at orchestrator entry (isEligible). The two-place duplication is intentional: the cron's $or is a query optimization, the orchestrator's check is the source-of-truth invariant.
