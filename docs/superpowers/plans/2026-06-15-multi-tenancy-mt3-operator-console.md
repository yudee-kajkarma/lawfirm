# Multi-Tenancy MT-3 (Operator Console) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

> **Project rule — commits are user-owned:** Every "commit step" stops at a staging-ready summary. **DO NOT run `git add` or `git commit`.** The whole MT-3 phase accumulates as uncommitted changes; the user verifies via the smoke-test gate at the bottom and commits with their own message.

> **Pacing rule:** Execute Tasks 1–5 in one stretch with internal subagent reviews and present one consolidated report at the end. Smoke-test gate is at the bottom.

**Goal:** Add a separate "platform operator" identity (you and your support team) with its own login + `/admin` UI for listing tenants, viewing per-tenant detail, and running the suspend / reactivate / schedule-purge / cancel-purge actions. Operator actions write to a separate `operatorAuditLogs` collection so per-tenant audit logs stay clean.

**Architecture:** A second authentication path through the same Auth.js Credentials provider — `authorize` tries the `User` collection first (tenant user), then falls back to a new `PlatformOperator` collection. JWT discriminator field `kind: 'tenant_user' | 'operator'` keeps them structurally distinct. Operator routes use a new `withOperatorAuth` wrapper (parallel to `withAuth`) that hydrates a `HydratedOperator` type WITHOUT a `tenantId` — so calling `scopedQuery(operator)` is a TypeScript error.

**Tech Stack:** Next.js 15, Mongoose 9, Auth.js v5, TanStack Query, shadcn/ui. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-06-13-multi-tenancy-design.md` — §6.4 (Operator console), §8 MT-3.

**MT-0/1/2 already in place (do not re-do):**
- `tenantScopePlugin`, `tenantAggregate`, `TENANT_MODELS` registry.
- `Tenant` model with `status: 'active' | 'suspended' | 'pending_purge' | 'purging'`.
- Public signup, login, kill-switch.

**Out of scope for MT-3 (deferred):**
- Operator-as-tenant impersonation (spec §6.4 last paragraph).
- The actual purge execution pipeline (MT-4).
- Real-time / streaming cross-tenant analytics beyond simple counts.
- Operator self-serve account creation — seed-script only per spec.

---

## File map

### Create — models + auth foundation
- `lib/models/PlatformOperator.ts` — operator identity (no `tenantId`).
- `lib/models/OperatorAuditLog.ts` — operator activity log (separate from per-tenant `auditLogs`).
- `lib/utils/validators/operator.ts` — Zod schemas for operator login + suspension actions.

### Create — auth + middleware
- `lib/auth/withOperatorAuth.ts` — operator-only API wrapper (parallel to `withAuth`).
- `lib/services/operatorAudit.ts` — `writeOperatorAudit(...)` helper.
- `scripts/seed-operator.ts` — bootstrap operator account from env vars.

### Create — operator API routes
- `app/api/operator/tenants/route.ts` — `GET` list (cursor-paginated).
- `app/api/operator/tenants/[id]/route.ts` — `GET` detail with counts.
- `app/api/operator/tenants/[id]/suspend/route.ts` — `POST`.
- `app/api/operator/tenants/[id]/reactivate/route.ts` — `POST`.
- `app/api/operator/tenants/[id]/schedule-purge/route.ts` — `POST`.
- `app/api/operator/tenants/[id]/cancel-purge/route.ts` — `POST`.
- `app/api/operator/audit/route.ts` — `GET` operator activity log.

### Create — operator UI
- `app/(operator)/admin/layout.tsx` — operator shell (no BU selector).
- `app/(operator)/admin/page.tsx` — redirect to `/admin/tenants`.
- `app/(operator)/admin/tenants/page.tsx` — list page.
- `app/(operator)/admin/tenants/TenantsClient.tsx` — list client component.
- `app/(operator)/admin/tenants/[id]/page.tsx` — detail page.
- `app/(operator)/admin/tenants/[id]/TenantDetailClient.tsx` — detail + action buttons.
- `app/(operator)/admin/audit/page.tsx` — operator audit page.
- `app/(operator)/admin/audit/AuditClient.tsx`.
- `components/layout/OperatorShell.tsx`.
- `components/layout/OperatorSidebar.tsx`.
- `components/operator/SuspendConfirmDialog.tsx`.
- `components/operator/SchedulePurgeConfirmDialog.tsx`.
- `hooks/useOperatorTenants.ts` — TanStack Query hooks (list, detail, mutations).
- `hooks/useOperatorAudit.ts`.
- `types/operator.ts` — wire-shape TS types (`OperatorTenantListItem`, `OperatorTenantDetail`, `OperatorAuditEntry`).

### Create — integration test
- `scripts/test-operator-flow.ts` — programmatic operator login + suspend + reactivate + audit.

### Modify
- `auth.ts` — two-step credentials lookup (User → PlatformOperator).
- `auth.config.ts` — JWT + session callbacks discriminate `kind`.
- `types/next-auth.d.ts` — add `kind`, `operatorId`.
- `lib/auth/requestContext.ts` — add `operator` field to `RequestContext` for operator-driven mutations.
- `middleware.ts` — `/admin/*` requires `kind === 'operator'`; operators are confined to `/admin/*`.
- `package.json` — `seed:operator` + `test:operator-flow` scripts.

---

## Task 1 — Models + auth integration (the foundation)

**Why first:** Every other task touches the new collections and the discriminated JWT.

### Files
- Create: `lib/models/PlatformOperator.ts`
- Create: `lib/models/OperatorAuditLog.ts`
- Create: `lib/utils/validators/operator.ts`
- Modify: `auth.ts`
- Modify: `auth.config.ts`
- Modify: `types/next-auth.d.ts`
- Modify: `lib/auth/requestContext.ts`

- [ ] **Step 1: `PlatformOperator` model**

`lib/models/PlatformOperator.ts`:

```ts
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * Platform operators — you and your support team. Sit ABOVE the tenant
 * hierarchy: no tenantId, no tenantScopePlugin. Seeded via a script
 * (`scripts/seed-operator.ts`); no self-serve creation UI.
 *
 * Operator email is globally unique. The auth flow (auth.ts) looks up
 * `User` first (tenant user) and falls back to this collection. The dual
 * check that a single email exists in only one place is enforced softly:
 * - tenant signup rejects emails that exist as PlatformOperator
 * - seed-operator rejects emails that exist as User
 */
const PlatformOperatorSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Deliberately NO plugins:
//   - tenantScopePlugin — operators sit above the tenant boundary.
//   - softDeletePlugin — small collection, hard-delete is fine.
//   - auditLogPlugin — operator activity goes into OperatorAuditLog manually.

export type PlatformOperatorDoc = InferSchemaType<typeof PlatformOperatorSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PlatformOperator: Model<PlatformOperatorDoc> =
  (mongoose.models.PlatformOperator as Model<PlatformOperatorDoc>) ??
  mongoose.model<PlatformOperatorDoc>('PlatformOperator', PlatformOperatorSchema);

export function serializePlatformOperator(doc: Record<string, unknown>): {
  _id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
} {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  const isoDateOrNull = (v: unknown): string | null =>
    v == null ? null : isoDate(v);
  return {
    _id: String(doc._id),
    email: String(doc.email ?? ''),
    name: String(doc.name ?? ''),
    isActive: doc.isActive !== false,
    lastLoginAt: isoDateOrNull(doc.lastLoginAt),
    createdAt: isoDate(doc.createdAt),
    updatedAt: isoDate(doc.updatedAt),
  };
}
```

- [ ] **Step 2: `OperatorAuditLog` model**

`lib/models/OperatorAuditLog.ts`:

```ts
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

export const OPERATOR_AUDIT_ACTIONS = [
  'login',
  'suspend_tenant',
  'reactivate_tenant',
  'schedule_purge',
  'cancel_purge',
] as const;
export type OperatorAuditAction = (typeof OPERATOR_AUDIT_ACTIONS)[number];

/**
 * Separate from per-tenant `auditLogs` so platform-level activity doesn't
 * clutter what tenant admins see. No tenantScopePlugin — this collection
 * is cross-tenant by nature.
 */
const OperatorAuditLogSchema = new Schema(
  {
    operatorId: { type: Schema.Types.ObjectId, ref: 'PlatformOperator', required: true, index: true },
    operatorEmail: { type: String, required: true },
    action: { type: String, enum: OPERATOR_AUDIT_ACTIONS, required: true, index: true },
    targetTenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    targetTenantSlug: { type: String, default: null },
    details: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

OperatorAuditLogSchema.index({ operatorId: 1, createdAt: -1 });
OperatorAuditLogSchema.index({ targetTenantId: 1, createdAt: -1 });
OperatorAuditLogSchema.index({ action: 1, createdAt: -1 });

export type OperatorAuditLogDoc = InferSchemaType<typeof OperatorAuditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OperatorAuditLog: Model<OperatorAuditLogDoc> =
  (mongoose.models.OperatorAuditLog as Model<OperatorAuditLogDoc>) ??
  mongoose.model<OperatorAuditLogDoc>('OperatorAuditLog', OperatorAuditLogSchema);

export function serializeOperatorAuditLog(doc: Record<string, unknown>): {
  _id: string;
  operatorId: string;
  operatorEmail: string;
  action: OperatorAuditAction;
  targetTenantId: string | null;
  targetTenantSlug: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
} {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  return {
    _id: String(doc._id),
    operatorId: String(doc.operatorId),
    operatorEmail: String(doc.operatorEmail ?? ''),
    action: (doc.action as OperatorAuditAction) ?? 'login',
    targetTenantId: doc.targetTenantId == null ? null : String(doc.targetTenantId),
    targetTenantSlug: doc.targetTenantSlug == null ? null : String(doc.targetTenantSlug),
    details: (doc.details as Record<string, unknown> | null) ?? null,
    ip: doc.ip == null ? null : String(doc.ip),
    userAgent: doc.userAgent == null ? null : String(doc.userAgent),
    createdAt: isoDate(doc.createdAt),
  };
}
```

- [ ] **Step 3: Zod validators**

`lib/utils/validators/operator.ts`:

```ts
import { z } from 'zod';

export const operatorCreateSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(120).trim(),
  password: z.string().min(8).max(200),
});
export type OperatorCreateInput = z.infer<typeof operatorCreateSchema>;

// suspend / reactivate are no-body POSTs; schedule-purge is also no-body.
// cancel-purge same. We keep this schema for future use (e.g. reason text).
export const operatorActionSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type OperatorActionInput = z.infer<typeof operatorActionSchema>;
```

- [ ] **Step 4: Augment Auth.js types**

`types/next-auth.d.ts` — add `kind` and `operatorId`. The shape becomes a discriminated union over `kind`. For ergonomics, use intersection types so both fields are present-but-optional on the session/JWT and the kind discriminator narrows:

```ts
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    kind: 'tenant_user' | 'operator';
    // tenant_user fields
    isAdmin?: boolean;
    tenantId?: string;
    businessUnits?: string[];
    // operator fields — none additional, the identity is just _id + email + name
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      kind: 'tenant_user' | 'operator';
      // tenant_user fields (undefined for operators)
      isAdmin?: boolean;
      tenantId?: string;
      businessUnits?: string[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    kind?: 'tenant_user' | 'operator';
    isAdmin?: boolean;
    tenantId?: string;
    businessUnits?: string[];
  }
}
```

(The optional `isAdmin` / `tenantId` may now be undefined on a tenant_user session if the JWT is from before MT-3 — middleware/withAuth re-validate, so this is fine.)

- [ ] **Step 5: `auth.config.ts` — propagate `kind` and conditionally the tenant fields**

Replace the `jwt` callback body:

```ts
jwt({ token, user }) {
  if (user) {
    const kind = user.kind ?? 'tenant_user';
    token.kind = kind;
    if (user.email) token.email = user.email;
    if (user.name) token.name = user.name;
    if (kind === 'tenant_user') {
      token.isAdmin = Boolean(user.isAdmin);
      token.tenantId = typeof user.tenantId === 'string' ? user.tenantId : '';
      token.businessUnits = Array.isArray(user.businessUnits) ? [...user.businessUnits] : [];
    } else {
      // operator — clear any tenant-side fields so a previous session
      // doesn't leak through after upgrading the JWT.
      delete token.isAdmin;
      delete token.tenantId;
      delete token.businessUnits;
    }
  }
  return token;
},
session({ session, token }) {
  if (token.sub) session.user.id = token.sub;
  session.user.kind = (token.kind as 'tenant_user' | 'operator') ?? 'tenant_user';
  if (typeof token.email === 'string') session.user.email = token.email;
  if (typeof token.name === 'string') session.user.name = token.name;
  if (session.user.kind === 'tenant_user') {
    session.user.isAdmin = Boolean(token.isAdmin);
    session.user.tenantId = typeof token.tenantId === 'string' ? token.tenantId : '';
    session.user.businessUnits = Array.isArray(token.businessUnits)
      ? (token.businessUnits as string[])
      : [];
  } else {
    session.user.isAdmin = undefined;
    session.user.tenantId = undefined;
    session.user.businessUnits = undefined;
  }
  return session;
},
```

- [ ] **Step 6: `auth.ts` — two-step credentials lookup**

Replace the `authorize(credentials)` body. The existing flow becomes the "try User first" branch, and a parallel branch tries `PlatformOperator`.

```ts
async authorize(credentials) {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return null;
  const email = parsed.data.email.toLowerCase();

  await connectDb();

  // 1. Try User (tenant user).
  const userDoc = await User.findOne({ email })
    .setOptions({ __crossTenant: true })
    .select('+passwordHash');

  if (userDoc) {
    if (!userDoc.isActive) return null;
    const okUser = await verifyPassword(parsed.data.password, userDoc.passwordHash);
    if (!okUser) return null;
    if (!userDoc.tenantId) return null;

    const tenantDoc = await Tenant.findById(userDoc.tenantId).lean();
    if (!tenantDoc || tenantDoc.status !== 'active') return null;

    await User.updateOne(
      { _id: userDoc._id, tenantId: userDoc.tenantId },
      { lastLoginAt: new Date() },
    );

    return {
      id: userDoc._id.toString(),
      email: String(userDoc.email),
      name: String(userDoc.name),
      kind: 'tenant_user' as const,
      isAdmin: Boolean(userDoc.isAdmin),
      tenantId: String(userDoc.tenantId),
      businessUnits: [...userDoc.businessUnits],
    };
  }

  // 2. Try PlatformOperator.
  const opDoc = await PlatformOperator.findOne({ email }).select('+passwordHash');
  if (!opDoc || !opDoc.isActive) return null;
  const okOp = await verifyPassword(parsed.data.password, opDoc.passwordHash);
  if (!okOp) return null;

  await PlatformOperator.updateOne({ _id: opDoc._id }, { lastLoginAt: new Date() });

  return {
    id: opDoc._id.toString(),
    email: String(opDoc.email),
    name: String(opDoc.name),
    kind: 'operator' as const,
  };
},
```

Add `import { PlatformOperator } from '@/lib/models/PlatformOperator';` at the top.

NOTE: the operator "login" audit-log entry is written from a higher-level place (server action calling `writeOperatorAudit`) in Task 2. Don't try to write to `OperatorAuditLog` from inside `authorize` — Auth.js's edge runtime constraint makes Mongoose imports here risky beyond the existing `connectDb` boundary we already crossed for User lookup. We accept the small gap.

- [ ] **Step 7: `lib/auth/requestContext.ts` — add operator field**

Extend `RequestContext`:

```ts
export type RequestOperator = {
  _id: string;
  email: string;
};

export type RequestContext = {
  user: RequestUser | null;
  operator?: RequestOperator | null;
  source: AuditSource;
  ip?: string;
  userAgent?: string;
};
```

`RequestUser` stays as-is. `operator` is optional — every existing call site passes `user`, never sets `operator`. New operator code sets `operator` and leaves `user: null`.

- [ ] **Step 8: Typecheck + lint**

```
npm run typecheck && npm run lint
```

Both must PASS. (Linting may surface unused `Tenant`-import noise in places — fix inline.)

- [ ] **Step 9: Move to Task 2** — no commit.

---

## Task 2 — Operator auth wrapper + audit helper + middleware + seed

### Files
- Create: `lib/auth/withOperatorAuth.ts`
- Create: `lib/services/operatorAudit.ts`
- Create: `scripts/seed-operator.ts`
- Modify: `middleware.ts`
- Modify: `package.json` — add `seed:operator` script

- [ ] **Step 1: `withOperatorAuth` wrapper**

`lib/auth/withOperatorAuth.ts`:

```ts
import type { NextRequest } from 'next/server';

import { auth } from '@/auth';

import { connectDb } from '../db/connect';
import { PlatformOperator } from '../models/PlatformOperator';
import { apiError } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import { runWithContext } from './requestContext';

export type HydratedOperator = {
  _id: string;
  email: string;
  name: string;
  // Deliberately NO tenantId. Calling scopedQuery(operator) is a TS error.
};

type RouteContext<TParams = Record<string, string | string[]>> = {
  params: Promise<TParams>;
};

type Handler<TParams = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: { params: TParams },
  meta: { operator: HydratedOperator },
) => Promise<Response> | Response;

/**
 * Operator-only API wrapper. Refuses anything that isn't a fresh
 * `kind: 'operator'` session and a still-active PlatformOperator.
 */
export function withOperatorAuth<TParams = Record<string, string | string[]>>(
  handler: Handler<TParams>,
) {
  return async (req: NextRequest, ctx: RouteContext<TParams>): Promise<Response> => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return apiError('UNAUTHORIZED', 'Not signed in', 401);
      }
      if (session.user.kind !== 'operator') {
        return apiError('FORBIDDEN', 'Operator access required', 403);
      }

      await connectDb();
      const opDoc = await PlatformOperator.findById(session.user.id);
      if (!opDoc || !opDoc.isActive) {
        return apiError('UNAUTHORIZED', 'Operator not found or inactive', 401);
      }

      const hydrated: HydratedOperator = {
        _id: opDoc._id.toString(),
        email: opDoc.email,
        name: opDoc.name,
      };

      const params = await ctx.params;

      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        undefined;
      const userAgent = req.headers.get('user-agent') ?? undefined;

      return await runWithContext(
        {
          user: null,
          operator: { _id: hydrated._id, email: hydrated.email },
          source: 'system', // operator actions are recorded in OperatorAuditLog separately
          ip,
          userAgent,
        },
        async () => handler(req, { params }, { operator: hydrated }),
      );
    } catch (err) {
      if (err instanceof AppError) {
        return apiError(err.code, err.message, err.statusCode, err.details);
      }
      console.error('[withOperatorAuth] unhandled error', err);
      return apiError('INTERNAL_ERROR', 'Something went wrong', 500);
    }
  };
}
```

- [ ] **Step 2: `operatorAudit` service**

`lib/services/operatorAudit.ts`:

```ts
import type { Types } from 'mongoose';

import { connectDb } from '@/lib/db/connect';
import { OperatorAuditLog, type OperatorAuditAction } from '@/lib/models/OperatorAuditLog';

import type { HydratedOperator } from '@/lib/auth/withOperatorAuth';

export type WriteOperatorAuditInput = {
  operator: HydratedOperator;
  action: OperatorAuditAction;
  targetTenant?: { _id: Types.ObjectId | string; slug: string } | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Single chokepoint for writing to operatorAuditLogs. Never throws — if the
 * audit write fails, the main operator action must still complete.
 */
export async function writeOperatorAudit(input: WriteOperatorAuditInput): Promise<void> {
  try {
    await connectDb();
    await OperatorAuditLog.create({
      operatorId: input.operator._id,
      operatorEmail: input.operator.email,
      action: input.action,
      targetTenantId: input.targetTenant?._id ?? null,
      targetTenantSlug: input.targetTenant?.slug ?? null,
      details: input.details ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error('[operatorAudit] failed to write entry', { action: input.action, err });
  }
}
```

- [ ] **Step 3: Middleware — gate `/admin/*` and confine operators**

In `middleware.ts`, the current logic uses `isAuthed`, `isAdmin`, `isPublic`. Extend it to also discriminate `kind`. Replace the body of the exported `auth((req) => {...})`:

```ts
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;
  const kind = req.auth?.user?.kind;
  const isOperator = kind === 'operator';
  const isAdmin = req.auth?.user?.isAdmin === true;

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/suspended';

  if (!isAuthed && !isPublic) {
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Authed users have no business on the auth pages.
  if (isAuthed && (pathname === '/login' || pathname === '/signup')) {
    const home = isOperator ? '/admin/tenants' : '/dashboard';
    return NextResponse.redirect(new URL(home, req.url));
  }

  // Operators may ONLY use /admin/*. Anywhere else → /admin/tenants.
  if (isOperator && !pathname.startsWith('/admin') && !isPublic) {
    return NextResponse.redirect(new URL('/admin/tenants', req.url));
  }

  // /admin/* requires an operator. Tenant users (or unauthed, already caught)
  // get bounced to the dashboard.
  if (pathname.startsWith('/admin') && !isOperator) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Tenant-admin-only settings still gated by isAdmin (existing rule).
  if (isAuthed && pathname.startsWith('/settings') && !isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});
```

- [ ] **Step 4: Seed-operator script**

`scripts/seed-operator.ts`:

```ts
/**
 * Creates a PlatformOperator account from env vars.
 *
 *   npm run seed:operator
 *
 * Env:
 *   SEED_OPERATOR_EMAIL    (required)
 *   SEED_OPERATOR_PASSWORD (required)
 *   SEED_OPERATOR_NAME     (default: "Platform Operator")
 *
 * Rejects if the email is already a tenant User (spec §5.4 — one email,
 * one identity).
 */

import { hashPassword } from '../lib/auth/password';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { PlatformOperator } from '../lib/models/PlatformOperator';
import { User } from '../lib/models/User';

async function main(): Promise<void> {
  const email = (process.env.SEED_OPERATOR_EMAIL ?? '').toLowerCase().trim();
  const password = process.env.SEED_OPERATOR_PASSWORD ?? '';
  const name = process.env.SEED_OPERATOR_NAME ?? 'Platform Operator';

  if (!email || !password) {
    console.error('SEED_OPERATOR_EMAIL and SEED_OPERATOR_PASSWORD are required');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('SEED_OPERATOR_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  console.log('\nSeeding PlatformOperator\n');
  await connectDb();

  // Cross-collection check — reject if email is already a tenant user.
  const tenantClash = await User.findOne({ email })
    .setOptions({ __crossTenant: true, withDeleted: true });
  if (tenantClash) {
    console.error(`Email ${email} is already a tenant user — operator seed rejected.`);
    await disconnectDb();
    process.exit(1);
  }

  const existing = await PlatformOperator.findOne({ email });
  if (existing) {
    console.log(`  [skip] operator ${email} already exists (${existing._id})`);
    await disconnectDb();
    return;
  }

  const passwordHash = await hashPassword(password);
  const op = await PlatformOperator.create({
    email,
    name,
    passwordHash,
    isActive: true,
  });
  console.log(`  [create] ${op.email} → _id=${op._id}`);

  await disconnectDb();
  console.log(`\nDone. Sign in at /login with: ${email} / <your password>`);
  console.log('You will be redirected to /admin/tenants on success.\n');
}

main().catch((err) => {
  console.error('\nSeed-operator failed:', err);
  process.exit(1);
});
```

- [ ] **Step 5: package.json — `seed:operator` script**

Append after `seed:reset`:

```json
    "seed:operator": "tsx --env-file=.env.local scripts/seed-operator.ts",
```

- [ ] **Step 6: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS.

- [ ] **Step 7: Move to Task 3** — no commit.

---

## Task 3 — Operator API routes

### Files
- Create: `app/api/operator/tenants/route.ts`
- Create: `app/api/operator/tenants/[id]/route.ts`
- Create: `app/api/operator/tenants/[id]/suspend/route.ts`
- Create: `app/api/operator/tenants/[id]/reactivate/route.ts`
- Create: `app/api/operator/tenants/[id]/schedule-purge/route.ts`
- Create: `app/api/operator/tenants/[id]/cancel-purge/route.ts`
- Create: `app/api/operator/audit/route.ts`

All routes use `withOperatorAuth`. Cross-tenant queries use `setOptions({ __crossTenant: true })`. Per spec §4.3, this is the legitimate use case the flag exists for.

- [ ] **Step 1: `GET /api/operator/tenants` — list**

`app/api/operator/tenants/route.ts`:

```ts
import { Types, isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withOperatorAuth(async (req) => {
  await connectDb();
  const sp = req.nextUrl.searchParams;

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

  const filter: Record<string, unknown> = {};

  const status = sp.get('status');
  if (status) filter.status = status;

  const search = sp.get('search');
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: re }, { slug: re }, { ownerEmail: re }];
  }

  // Cursor pagination by _id desc.
  const cursor = sp.get('cursor');
  if (cursor && isValidObjectId(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await Tenant.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasNext = docs.length > limit;
  const items = hasNext ? docs.slice(0, limit) : docs;
  const nextCursor = hasNext ? String(items[items.length - 1]!._id) : null;

  // Per-tenant user counts — single aggregate with __crossTenant.
  const tenantIds = items.map((t) => t._id);
  const userCounts = await User.aggregate([
    { $match: { tenantId: { $in: tenantIds }, deletedAt: null } },
    { $group: { _id: '$tenantId', count: { $sum: 1 } } },
  ]);
  const countsByTenant = new Map<string, number>(
    userCounts.map((r) => [String(r._id), Number(r.count)]),
  );

  const data = items.map((t) => ({
    _id: String(t._id),
    name: String(t.name),
    slug: String(t.slug),
    status: t.status,
    ownerEmail: String(t.ownerEmail),
    suspendedAt: t.suspendedAt ? new Date(t.suspendedAt).toISOString() : null,
    purgeScheduledAt: t.purgeScheduledAt ? new Date(t.purgeScheduledAt).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    userCount: countsByTenant.get(String(t._id)) ?? 0,
  }));

  return apiOk({ data, meta: { cursor: nextCursor, limit } });
});
```

Note: `User.aggregate` here is the ONE place in the app where raw `.aggregate(` is legitimate-cross-tenant. Add an eslint-disable comment with the rationale:

```ts
  // Cross-tenant aggregation is intentional — operator surface.
  // eslint-disable-next-line no-restricted-syntax -- operator console, cross-tenant by design
  const userCounts = await User.aggregate([
    { $match: { tenantId: { $in: tenantIds }, deletedAt: null } },
    { $group: { _id: '$tenantId', count: { $sum: 1 } } },
  ]);
```

- [ ] **Step 2: `GET /api/operator/tenants/[id]` — detail**

`app/api/operator/tenants/[id]/route.ts`:

```ts
import { isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { BusinessUnit } from '@/lib/models/BusinessUnit';
import { Case } from '@/lib/models/Case';
import { Contact } from '@/lib/models/Contact';
import { Invoice } from '@/lib/models/Invoice';
import { Lead } from '@/lib/models/Lead';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withOperatorAuth<Params>(async (_req, { params }) => {
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Tenant not found', 404);
  }
  await connectDb();

  const tenant = await Tenant.findById(params.id).lean();
  if (!tenant) return apiError('NOT_FOUND', 'Tenant not found', 404);

  const tid = tenant._id;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [bus, userCount, leadsTotal, leads7d, casesTotal, cases7d, contactsTotal, invoicesTotal] =
    await Promise.all([
      BusinessUnit.find({ tenantId: tid }).sort({ order: 1 }).lean(),
      User.countDocuments({ tenantId: tid }),
      Lead.countDocuments({ tenantId: tid }),
      Lead.countDocuments({ tenantId: tid, createdAt: { $gte: sevenDaysAgo } }),
      Case.countDocuments({ tenantId: tid }),
      Case.countDocuments({ tenantId: tid, createdAt: { $gte: sevenDaysAgo } }),
      Contact.countDocuments({ tenantId: tid }),
      Invoice.countDocuments({ tenantId: tid }),
    ]);

  return apiOk({
    data: {
      tenant: {
        _id: String(tenant._id),
        name: String(tenant.name),
        slug: String(tenant.slug),
        status: tenant.status,
        ownerEmail: String(tenant.ownerEmail),
        suspendedAt: tenant.suspendedAt ? new Date(tenant.suspendedAt).toISOString() : null,
        purgeScheduledAt: tenant.purgeScheduledAt ? new Date(tenant.purgeScheduledAt).toISOString() : null,
        createdAt: new Date(tenant.createdAt).toISOString(),
      },
      businessUnits: bus.map((b) => ({
        _id: String(b._id),
        key: String(b.key),
        name: String(b.name),
        color: String(b.color ?? '#64748b'),
        isActive: b.isActive !== false,
      })),
      counts: {
        users: userCount,
        leadsTotal,
        leads7d,
        casesTotal,
        cases7d,
        contactsTotal,
        invoicesTotal,
      },
    },
  });
});
```

- [ ] **Step 3: Action routes (suspend / reactivate / schedule-purge / cancel-purge)**

Pattern for each (write each as its own file):

`app/api/operator/tenants/[id]/suspend/route.ts`:

```ts
import { isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { Tenant } from '@/lib/models/Tenant';
import { writeOperatorAudit } from '@/lib/services/operatorAudit';
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
  if (tenant.status === 'pending_purge' || tenant.status === 'purging') {
    return apiError('CONFLICT', 'Tenant is already scheduled for purge', 409);
  }
  if (tenant.status === 'suspended') {
    return apiError('CONFLICT', 'Tenant is already suspended', 409);
  }

  tenant.status = 'suspended';
  tenant.suspendedAt = new Date();
  await tenant.save();

  await writeOperatorAudit({
    operator,
    action: 'suspend_tenant',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  });

  return apiOk({ data: { _id: String(tenant._id), status: tenant.status } });
});
```

Reactivate (`reactivate/route.ts`) — symmetric:

- only valid if status is `suspended` OR (`pending_purge` AND `purgeScheduledAt` is in the future — same as cancel-purge).
- For MT-3, ONLY accept `suspended` → `active`. The `cancel-purge` route handles the pending_purge unwind.
- Sets `status = 'active'`, clears `suspendedAt`.
- Audit action: `reactivate_tenant`.

Schedule-purge (`schedule-purge/route.ts`):

- Valid only if status is `suspended`.
- Sets `status = 'pending_purge'`, `purgeScheduledAt = suspendedAt + 30 days`.
- If `suspendedAt` is null (shouldn't happen — suspended must have a timestamp), use now.
- Audit action: `schedule_purge`. Include `details: { purgeScheduledAt }`.

Cancel-purge (`cancel-purge/route.ts`):

- Valid only if status is `pending_purge` AND `purgeScheduledAt > now` (still in the grace window).
- Sets `status = 'suspended'`, clears `purgeScheduledAt`.
- Audit action: `cancel_purge`.

Implement each with the same shape as `suspend/route.ts`. Use 409 CONFLICT when the transition isn't valid; 404 when the tenant doesn't exist.

- [ ] **Step 4: `GET /api/operator/audit` — list operator activity**

`app/api/operator/audit/route.ts`:

```ts
import { Types, isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import {
  OPERATOR_AUDIT_ACTIONS,
  OperatorAuditLog,
  serializeOperatorAuditLog,
} from '@/lib/models/OperatorAuditLog';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const GET = withOperatorAuth(async (req) => {
  await connectDb();
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

  const filter: Record<string, unknown> = {};

  const action = sp.get('action');
  if (action && (OPERATOR_AUDIT_ACTIONS as readonly string[]).includes(action)) {
    filter.action = action;
  }

  const operatorEmail = sp.get('operatorEmail');
  if (operatorEmail) filter.operatorEmail = new RegExp(operatorEmail, 'i');

  const cursor = sp.get('cursor');
  if (cursor && isValidObjectId(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await OperatorAuditLog.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasNext = docs.length > limit;
  const items = hasNext ? docs.slice(0, limit) : docs;
  const nextCursor = hasNext ? String(items[items.length - 1]!._id) : null;

  return apiOk({
    data: items.map((d) => serializeOperatorAuditLog(d as Record<string, unknown>)),
    meta: { cursor: nextCursor, limit },
  });
});
```

- [ ] **Step 5: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS.

- [ ] **Step 6: Move to Task 4** — no commit.

---

## Task 4 — Operator UI

### Files

- Create: `types/operator.ts` — wire types matching the API responses.
- Create: `hooks/useOperatorTenants.ts` — TanStack Query hooks.
- Create: `hooks/useOperatorAudit.ts`.
- Create: `components/layout/OperatorShell.tsx`.
- Create: `components/layout/OperatorSidebar.tsx`.
- Create: `components/operator/SuspendConfirmDialog.tsx`.
- Create: `components/operator/SchedulePurgeConfirmDialog.tsx`.
- Create: `app/(operator)/admin/layout.tsx`.
- Create: `app/(operator)/admin/page.tsx`.
- Create: `app/(operator)/admin/tenants/page.tsx`.
- Create: `app/(operator)/admin/tenants/TenantsClient.tsx`.
- Create: `app/(operator)/admin/tenants/[id]/page.tsx`.
- Create: `app/(operator)/admin/tenants/[id]/TenantDetailClient.tsx`.
- Create: `app/(operator)/admin/audit/page.tsx`.
- Create: `app/(operator)/admin/audit/AuditClient.tsx`.

This task is mechanical UI work — follow the existing patterns from `/settings/business-units/` and `/settings/audit-log/`. Highlights:

- [ ] **Step 1: Wire types — `types/operator.ts`**

```ts
import type { TenantStatus } from '@/lib/models/Tenant';
import type { OperatorAuditAction } from '@/lib/models/OperatorAuditLog';

export type OperatorTenantListItem = {
  _id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  ownerEmail: string;
  suspendedAt: string | null;
  purgeScheduledAt: string | null;
  createdAt: string;
  userCount: number;
};

export type OperatorTenantDetail = {
  tenant: {
    _id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    ownerEmail: string;
    suspendedAt: string | null;
    purgeScheduledAt: string | null;
    createdAt: string;
  };
  businessUnits: Array<{
    _id: string;
    key: string;
    name: string;
    color: string;
    isActive: boolean;
  }>;
  counts: {
    users: number;
    leadsTotal: number;
    leads7d: number;
    casesTotal: number;
    cases7d: number;
    contactsTotal: number;
    invoicesTotal: number;
  };
};

export type OperatorAuditEntry = {
  _id: string;
  operatorId: string;
  operatorEmail: string;
  action: OperatorAuditAction;
  targetTenantId: string | null;
  targetTenantSlug: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};
```

- [ ] **Step 2: Hooks**

`hooks/useOperatorTenants.ts` — use TanStack Query. Follow the existing `useUsersList` / `useUser` / `useUpdateUser` pattern from `hooks/useUsers.ts`. Provide:
- `useOperatorTenantsList(filters)` — cursor-paginated infinite query, mirrors `useAuditLogs`.
- `useOperatorTenant(id)` — single fetch.
- `useSuspendTenant()`, `useReactivateTenant()`, `useSchedulePurge()`, `useCancelPurge()` — POST mutations, each invalidates the list and the detail queries.

`hooks/useOperatorAudit.ts` — infinite query for the audit log feed, same shape as `useAuditLogs`.

Inside `mutationFn`, await `qc.invalidateQueries({ queryKey: ['operatorTenants'], refetchType: 'all' })` per the saved cache-staleness memory.

- [ ] **Step 3: Operator shell + sidebar**

`components/layout/OperatorShell.tsx` — simpler than AppShell: NO BU selector, NO BusinessUnitProvider. Just sidebar + header + main.

```tsx
'use client';

import type { ReactNode } from 'react';

import { OperatorSidebar } from './OperatorSidebar';
// Reuse the existing Header (just user dropdown + logout — adapt as needed)
import { Header } from './Header';

type Props = { children: ReactNode };

export function OperatorShell({ children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <OperatorSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
```

`components/layout/OperatorSidebar.tsx` — mirror `Sidebar.tsx` but with operator-specific items:
- Tenants → `/admin/tenants`
- Audit → `/admin/audit`

No isAdmin / BU logic. Header is fine as-is — it shows the user name + signout via UserMenu.

If `Header.tsx` reads `useBusinessUnit()` and that throws when there's no BusinessUnitProvider, gate that read or split the Header — the simplest fix is to make OperatorShell wrap in a "noop" BusinessUnitProvider with empty BUs and a fake defaultBU like `'all'`. Pick the simpler of the two; prefer **splitting the BU widget out of Header** if Header is just doing the dropdown via the provider.

- [ ] **Step 4: Layout + redirect**

`app/(operator)/admin/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth } from '@/auth';
import { OperatorShell } from '@/components/layout/OperatorShell';

export const runtime = 'nodejs';

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.kind !== 'operator') {
    redirect('/login');
  }
  return <OperatorShell>{children}</OperatorShell>;
}
```

`app/(operator)/admin/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
export default function AdminRoot() {
  redirect('/admin/tenants');
}
```

- [ ] **Step 5: Tenants list page**

`app/(operator)/admin/tenants/page.tsx` — server component, defers to `TenantsClient`.

`app/(operator)/admin/tenants/TenantsClient.tsx` — client component using `useOperatorTenantsList`. Mirror the structure of `UsersClient.tsx`:
- Filters row: status select (`all / active / suspended / pending_purge`), search input.
- Table: name (link to detail), slug, status badge (color-coded per status), owner email, user count, created date.
- "Load more" button at bottom if `meta.cursor` is set.
- Loading skeleton + empty state + error retry per the saved Item 1–5 polish patterns.

- [ ] **Step 6: Tenant detail page**

`app/(operator)/admin/tenants/[id]/page.tsx` — server component, defers to `TenantDetailClient`.

`TenantDetailClient.tsx` — shows tenant header (name, slug, status badge), counts card (users, leads total / 7d, cases total / 7d, contacts, invoices), BU list, then action buttons depending on status:

- `active` → buttons: "Suspend" (opens `SuspendConfirmDialog`)
- `suspended` → buttons: "Reactivate", "Schedule purge"
- `pending_purge` → buttons: "Cancel purge" (only if purgeScheduledAt > now); show countdown to purge.
- `purging` → no buttons; show "Purge in progress".

`SuspendConfirmDialog.tsx` — `<AlertDialog>` requiring the user to type the tenant slug to confirm. Calls `useSuspendTenant()` on confirm.

`SchedulePurgeConfirmDialog.tsx` — same pattern, requires slug confirmation. Shows the computed purge date.

Use destructive variant on the action buttons. Show success/error toasts via `sonner`.

- [ ] **Step 7: Audit page**

`app/(operator)/admin/audit/page.tsx` + `AuditClient.tsx`. Mirror `/settings/audit-log/AuditLogClient.tsx` but for operator entries. Columns: timestamp, action (color-coded badge), operator email, target tenant slug (linked), details JSON. Cursor pagination.

- [ ] **Step 8: Typecheck + lint**

```
npm run typecheck && npm run lint
```
Both PASS. The eslint rule banning raw `.aggregate(` should accept the disabled lines you added in the tenants list route (Task 3 Step 1).

- [ ] **Step 9: Move to Task 5** — no commit.

---

## Task 5 — Integration test + final sweep

### Files
- Create: `scripts/test-operator-flow.ts`
- Modify: `package.json` — add `test:operator-flow` script.

- [ ] **Step 1: Add npm script**

After `test:tenant-signup`:
```json
    "test:operator-flow": "tsx --env-file=.env.local scripts/test-operator-flow.ts",
```

- [ ] **Step 2: Integration test**

`scripts/test-operator-flow.ts` — programmatically exercise the operator flows by calling the service / model layer directly (NOT through the HTTP API — same pattern as the other test scripts). Steps:

1. Connect; create a throwaway tenant via `performTenantSignup`.
2. Create a throwaway `PlatformOperator` (manually, NOT via seed-operator script — avoid env var dependency).
3. Construct a `HydratedOperator` manually.
4. Suspend the tenant (call the model directly, then `writeOperatorAudit`).
5. Verify status changed; verify an OperatorAuditLog entry exists.
6. Reactivate; verify status changed; verify audit entry.
7. Suspend again, schedule-purge, verify status and purgeScheduledAt.
8. Cancel-purge, verify status back to suspended.
9. Cleanup: purge tenant + delete operator + delete audit entries.

The test does NOT exercise the API routes or the UI — that's the user's manual gate. It exercises the data + service layer to confirm the state machine behaves.

```ts
/**
 * MT-3 smoke test — operator state machine.
 *
 * Run with: npm run test:operator-flow
 *
 * Exercises: suspend → reactivate → suspend → schedule-purge → cancel-purge.
 * Verifies OperatorAuditLog entries land for each action.
 *
 * Does NOT exercise HTTP routes or UI — that's the user's manual gate.
 */

import mongoose from 'mongoose';

import { hashPassword } from '../lib/auth/password';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { OperatorAuditLog } from '../lib/models/OperatorAuditLog';
import { PlatformOperator } from '../lib/models/PlatformOperator';
import { Tenant } from '../lib/models/Tenant';
import { performTenantSignup } from '../lib/services/tenantSignup';
import { writeOperatorAudit } from '../lib/services/operatorAudit';
import type { HydratedOperator } from '../lib/auth/withOperatorAuth';
import { BusinessUnit } from '../lib/models/BusinessUnit';
import { Settings } from '../lib/models/Settings';
import { User } from '../lib/models/User';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}
function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

let tenantId: mongoose.Types.ObjectId | null = null;
let operatorId: mongoose.Types.ObjectId | null = null;

async function cleanup(): Promise<void> {
  if (tenantId) {
    await User.deleteMany({ tenantId }).setOptions({ withDeleted: true });
    await BusinessUnit.deleteMany({ tenantId }).setOptions({ withDeleted: true });
    await Settings.deleteMany({ tenantId });
    await Tenant.deleteOne({ _id: tenantId });
  }
  if (operatorId) {
    await OperatorAuditLog.deleteMany({ operatorId });
    await PlatformOperator.deleteOne({ _id: operatorId });
  }
}

async function main(): Promise<void> {
  console.log('\nMT-3 operator-flow smoke test\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  // Setup: tenant + operator.
  const stamp = Date.now();
  const signup = await performTenantSignup({
    companyName: `MT3 Test Tenant ${stamp}`,
    ownerName: 'Owner',
    ownerEmail: `mt3-tenant-${stamp}@example.com`,
    password: 'TestPassword123!',
  });
  tenantId = signup.tenant._id;
  log('setup', `tenant ${signup.tenant.slug} created (_id=${tenantId})`);

  const op = await PlatformOperator.create({
    email: `mt3-op-${stamp}@example.com`,
    name: 'MT3 Test Operator',
    passwordHash: await hashPassword('TestPassword123!'),
    isActive: true,
  });
  operatorId = op._id;
  const operator: HydratedOperator = { _id: op._id.toString(), email: op.email, name: op.name };
  log('setup', `operator ${op.email} created`);

  // 1. Suspend.
  let tenant = await Tenant.findById(tenantId);
  if (!tenant) fail('suspend', 'tenant disappeared');
  tenant.status = 'suspended';
  tenant.suspendedAt = new Date();
  await tenant.save();
  await writeOperatorAudit({
    operator,
    action: 'suspend_tenant',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
  });
  log('suspend', `status=${tenant.status}, suspendedAt=${tenant.suspendedAt?.toISOString()}`);

  // 2. Reactivate.
  tenant.status = 'active';
  tenant.suspendedAt = null;
  await tenant.save();
  await writeOperatorAudit({
    operator,
    action: 'reactivate_tenant',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
  });
  log('reactivate', `status=${tenant.status}`);
  if (tenant.status !== 'active') fail('reactivate', 'status should be active');

  // 3. Suspend again, schedule-purge.
  tenant.status = 'suspended';
  tenant.suspendedAt = new Date();
  await tenant.save();
  tenant.status = 'pending_purge';
  const purgeAt = new Date(tenant.suspendedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  tenant.purgeScheduledAt = purgeAt;
  await tenant.save();
  await writeOperatorAudit({
    operator,
    action: 'schedule_purge',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
    details: { purgeScheduledAt: purgeAt.toISOString() },
  });
  log('schedule-purge', `status=${tenant.status}, purgeAt=${purgeAt.toISOString()}`);

  // 4. Cancel-purge.
  tenant.status = 'suspended';
  tenant.purgeScheduledAt = null;
  await tenant.save();
  await writeOperatorAudit({
    operator,
    action: 'cancel_purge',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
  });
  log('cancel-purge', `status=${tenant.status}`);

  // 5. Verify audit entries.
  const entries = await OperatorAuditLog.find({ operatorId: operator._id }).sort({ createdAt: 1 });
  log('audit', `${entries.length} entries (expected 4: suspend, reactivate, schedule_purge, cancel_purge)`);
  if (entries.length !== 4) fail('audit', 'wrong number of audit entries');
  const expectedActions = ['suspend_tenant', 'reactivate_tenant', 'schedule_purge', 'cancel_purge'];
  for (let i = 0; i < 4; i++) {
    if (entries[i]?.action !== expectedActions[i]) {
      fail('audit', `entry ${i}: expected ${expectedActions[i]}, got ${entries[i]?.action}`);
    }
  }
  log('audit', `actions in order: ${entries.map((e) => e.action).join(' → ')} ✓`);

  await cleanup();
  log('cleanup', 'removed test data');

  await disconnectDb();
  console.log('\n  ✓ MT-3 operator-flow smoke test passed\n');
}

main().catch(async (err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  try { await cleanup(); } catch {/* ignore */}
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
```

All 9 must PASS.

- [ ] **Step 4: Quick dev-server sanity check**

```
npm run dev
```

Without an operator account yet, `/admin/tenants` should redirect logged-in tenant users to `/dashboard` and unauthed users to `/login`. Don't try to actually use the console yet — the user runs the manual gate.

- [ ] **Step 5: Report to user** — end here.

---

## MT-3 smoke-test gate (user runs these)

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
npm run seed:operator                     # one-time: requires SEED_OPERATOR_EMAIL and SEED_OPERATOR_PASSWORD in .env.local
npm run dev
```

Add to `.env.local`:
```
SEED_OPERATOR_EMAIL=ops@instapath.test
SEED_OPERATOR_PASSWORD=OperatorPassword123!
SEED_OPERATOR_NAME=Ops Tester
```
Then `npm run seed:operator`.

## MT-3 manual gate

**Round 1 — operator sign-in + tenant browse:**

- [ ] Sign in as `ops@instapath.test` / `OperatorPassword123!`. **Land on `/admin/tenants`** (NOT `/dashboard`).
- [ ] Sidebar shows only "Tenants" and "Audit" — no BU selector.
- [ ] Visiting `/dashboard` redirects you to `/admin/tenants` (operators confined to /admin).
- [ ] Visiting `/settings/users` redirects you to `/admin/tenants`.
- [ ] Tenants list shows at minimum the default seeded tenant + any MT-2 tenants you created.

**Round 2 — tenant detail + state machine:**

- [ ] Click a tenant. Detail page shows: counts card (users, leads/cases 7d), BU list, action buttons matching status.
- [ ] Suspend it — confirm dialog requires typing the tenant slug. After confirm: status badge changes to "suspended" inline (TanStack Query invalidation).
- [ ] Open another tab, try to sign in as that tenant's admin user — fails with "Invalid email or password" (mid-session, also fails — close prior tab, retry).
- [ ] Back in operator: Reactivate. Tenant admin can sign in again.
- [ ] Suspend, then Schedule purge — confirm dialog shows the computed purge date. After confirm: status "pending_purge", purgeScheduledAt visible.
- [ ] Cancel purge — confirm dialog. Status returns to "suspended".
- [ ] Reactivate to clean state.

**Round 3 — operator audit:**

- [ ] Sidebar → Audit. Recent operator actions appear (login + the four state transitions).
- [ ] Action filter dropdown works.
- [ ] Filter by operator email works.

**Round 4 — isolation:**

- [ ] Sign out, sign in as `admin@instapath.com` (regular tenant admin). Navigate to `/admin/tenants` — redirected to `/dashboard`. **A tenant user must never see the operator console.**

**Cleanup:** none required — the seed-operator script is idempotent. To remove the operator, run a quick mongo shell command:
```
db.platformoperators.deleteOne({ email: 'ops@instapath.test' })
```

When everything ticks, MT-3 is done. Commit with a message like:
`feat: MT-3 — platform operator console`

---

## Self-review notes

- **Spec coverage:** §6.4 PlatformOperator model (Task 1), withOperatorAuth (Task 2), middleware split (Task 2 Step 3), tenants list + detail + 4 actions + audit (Task 3), UI (Task 4), seed script (Task 2 Step 4), integration test (Task 5). MT-3 from §8.
- **Placeholder scan:** zero `TBD`/`TODO` markers.
- **Type consistency:** `kind: 'tenant_user' | 'operator'` is used consistently across `auth.ts`, `auth.config.ts`, `types/next-auth.d.ts`, `middleware.ts`, `withOperatorAuth`. `HydratedOperator` has NO `tenantId`. `RequestContext.operator` is optional and `operator: { _id, email }` matches `RequestOperator`.
- **Scope:** MT-3 only. Impersonation, real purge execution, durable rate limit — all deferred in the File Map header.
- **Ambiguity:** the suspend confirm dialog "requires typing the slug" — Same pattern the existing BU deactivate confirm uses (see `components/settings/BusinessUnitEditSheet.tsx`'s AlertDialog). Reuse that pattern.
