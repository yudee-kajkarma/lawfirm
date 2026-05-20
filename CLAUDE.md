# CLAUDE.md

This file is the source of truth for working on this codebase. Read it fully before writing code. Update it when conventions change.

---

## 1. What this project is

A multi-tenant internal CRM for a service business operating across three business units:

- **Immigration**
- **Law**
- **Wealth**

The platform unifies lead-to-cash workflows: capture leads → qualify them → convert to clients → manage cases → handle communications, documents, tasks, calendar, invoices. Everything is segregated by business unit but uses one codebase, one database, one UI.

**Phase 1 scope (this build):** 14 modules — Dashboard, Leads, Pipeline, Contacts, Cases, Tasks, Calendar, Communications, Documents, Invoices, Smart Lists, Settings, plus the per-record detail pages.

**Deferred to Phase 2:** Stripe payment integration, AI Assistant (the floating "AI" button can stay as a UI stub).

---

## 2. Tech stack

Fixed. Don't suggest alternatives unless explicitly asked.

| Layer | Choice |
|---|---|
| Framework | **Next.js 14+** (App Router) |
| Language | **TypeScript** (strict) |
| UI | **React 18 + Tailwind CSS** |
| Icons | **lucide-react** |
| Database | **MongoDB** via **Mongoose** |
| Auth | **NextAuth.js** (Credentials provider, JWT sessions) |
| Data fetching (client) | **TanStack Query** |
| Validation | **Zod** for all API input |
| File storage | **AWS S3** (`@aws-sdk/client-s3` + signed URLs) |
| Email | **SendGrid** |
| SMS | **Twilio** |
| WhatsApp | **WhatsApp Business Cloud API** (deferred if Meta approval delayed) |
| Drag-and-drop | **@dnd-kit** (for Kanban pipeline) |

**Frontend code source:** the UI was designed in Figma and exported via Figma Make as a React/TS/Tailwind app. The exported components live under `/components` and **must not have their visual design altered** without sign-off. We can refactor internals (data fetching, state) freely; we cannot redesign the look.

---

## 3. Critical concepts — read these before doing anything

### 3.1 Business Unit (BU) segregation

Every business-facing record (`leads`, `cases`, `contacts`, `tasks`, `documents`, `invoices`, `threads`, `messages`, `calendarEvents`, `smartLists`, `activities`) has a required `businessUnit: string` field — one of `'immigration' | 'law' | 'wealth'` (or any new ones admin creates).

**A user only ever sees data from BUs in their `businessUnits` array.** Crossing this is a critical bug. Always go through `scopedQuery()` — never write raw queries that bypass it.

### 3.2 Access model — DELIBERATELY SIMPLE

There are no roles. There are no permission lists. Don't add any. The access model is:

- `user.isAdmin === true` → sees and does everything across all BUs, plus settings
- `user.isAdmin === false` + `user.businessUnits: string[]` → sees and does everything in those BUs only, no settings

That's it. Inside a BU, any non-admin user can create, edit, and delete anything. Accountability comes from the **audit log**, not from permissions.

When the client eventually asks "can we add roles" — that's a Phase 2 conversation. Don't pre-build for it.

### 3.3 Audit log

**Every mutation on every audit-tracked collection is automatically logged.** Field-level diffs, with actor, IP, user-agent, timestamp. Lives in the `auditLogs` collection. TTL-trimmed after 180 days.

You don't write to the audit log manually. The `auditLogPlugin` applied to each schema handles it via Mongoose hooks, reading the actor from `AsyncLocalStorage`. **Don't bypass this** by doing raw `db.collection.updateOne` operations — those skip Mongoose middleware entirely.

### 3.4 Soft delete

Every record has `deletedAt: Date | null`. The `softDeletePlugin` automatically filters `{ deletedAt: null }` from all queries.

- **To delete:** `doc.softDelete()` (instance method) — never `findByIdAndDelete`.
- **To see deleted records (admin restore UI only):** add `.setOptions({ withDeleted: true })` to the query.
- **In aggregations:** the plugin doesn't reach them — add `{ $match: { deletedAt: null } }` as the first stage, or use `withSoftDeleteMatch()` helper.

### 3.5 Polymorphic relations

Tasks, documents, threads, activities, and similar attach-anywhere entities use this shape:

```ts
relatedTo: {
  type: 'lead' | 'case' | 'contact',
  id: ObjectId
}
```

Indexed as a compound index `{ 'relatedTo.type': 1, 'relatedTo.id': 1 }`. Mongoose populate works via a `refPath`-style virtual.

---

## 4. Project structure

```
/app
  /(auth)/login/page.tsx
  /(dashboard)/                ← protected route group, shares sidebar+header
    /layout.tsx
    /dashboard/page.tsx
    /leads/page.tsx
    /leads/[id]/page.tsx
    /cases/page.tsx
    /cases/[id]/page.tsx
    /contacts/page.tsx
    /contacts/[id]/page.tsx
    /pipeline/page.tsx
    /tasks/page.tsx
    /calendar/page.tsx
    /communications/page.tsx
    /documents/page.tsx
    /invoices/page.tsx
    /invoices/[id]/page.tsx
    /smart-lists/page.tsx
    /settings/...
  /api/...                     ← see Section 7 for routing conventions
  /layout.tsx                  ← root: providers (QueryClient, SessionProvider, etc.)
  /globals.css

/components                    ← Figma Make exports + our additions
  /ui/                         ← primitives (Button, Card, Modal, Input, ...)
  /layout/                     ← Sidebar, Header, AIAssistantButton
  /leads/, /cases/, /pipeline/, /communications/, ...
  /shared/                     ← BusinessUnitFilter, StatusBadge, EmptyState, ...

/lib
  /db/
    connect.ts                 ← Mongoose connection with global caching
    softDeletePlugin.ts
    auditFieldsPlugin.ts
    auditLogPlugin.ts
  /models/                     ← Mongoose schemas (one per file)
    User.ts, BusinessUnit.ts, Contact.ts, Lead.ts, Case.ts,
    Task.ts, Document.ts, CalendarEvent.ts, Thread.ts, Message.ts,
    Invoice.ts, Activity.ts, AuditLog.ts, SmartList.ts, Settings.ts,
    CaseChecklist.ts, PipelineStage.ts
  /auth/
    requestContext.ts          ← AsyncLocalStorage for current user/request
    options.ts                 ← NextAuth config (Phase 0)
    withAuth.ts                ← API route wrapper (Phase 0)
    scopedQuery.ts             ← BU-scoped filter helper (Phase 0)
  /integrations/
    sendgrid.ts, twilio.ts, whatsapp.ts, storage.ts
  /utils/
    apiResponse.ts             ← consistent { success, data, error } shape
    validators/                ← Zod schemas, one file per resource
    errors.ts                  ← custom error classes
    smartListQuery.ts          ← filter-tree → Mongo query translator
    encryption.ts              ← for settings integration secrets
  /constants/
    enums.ts                   ← all enum values used by schemas

/hooks                         ← client-side hooks (useLeads, useCases, ...)
/types                         ← shared TS types
/scripts                       ← seed.ts, migrations
/middleware.ts                 ← edge auth gate
```

---

## 5. Database conventions

### 5.1 Schema rules

Every new schema **must**:

1. Be defined in `/lib/models/<Entity>.ts` as a single-file export.
2. Apply `softDeletePlugin` unless explicitly justified not to.
3. Apply `auditFieldsPlugin` (adds `createdBy` / `updatedBy`) for entities created by users.
4. Apply `auditLogPlugin` with the collection name.
5. Have a `businessUnit: string` field with `required: true, index: true` if it's a business-facing record.
6. Define composite indexes for any combination of fields used together in list filters.
7. Export both the Model and an `InferSchemaType`-derived TS type.

Standard skeleton:

```ts
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { softDeletePlugin } from '../db/softDeletePlugin';
import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';

const FooSchema = new Schema({
  name: { type: String, required: true, trim: true },
  businessUnit: { type: String, required: true, index: true },
  // ...
}, { timestamps: true });

FooSchema.plugin(softDeletePlugin);
FooSchema.plugin(auditFieldsPlugin);
FooSchema.plugin(auditLogPlugin, { collectionName: 'foos' });

FooSchema.index({ businessUnit: 1, status: 1 });

export type FooDoc = InferSchemaType<typeof FooSchema> & { _id: mongoose.Types.ObjectId };
export const Foo: Model<FooDoc> =
  (mongoose.models.Foo as Model<FooDoc>) ?? mongoose.model<FooDoc>('Foo', FooSchema);
```

The `mongoose.models.Foo ?? mongoose.model(...)` pattern is essential for Next.js hot reload — without it, you get "OverwriteModelError" on every code change.

### 5.2 ObjectId vs string references

- **Reference user, contact, case** → ObjectId, with `ref: 'User'` etc. Populate when needed.
- **Reference business unit** → string key (`'law'`), never ObjectId. Keeps queries readable.

### 5.3 Custom fields

Most business entities have a `customFields: Map<string, Mixed>`. Use it for BU-specific data (visa type for immigration, jurisdiction for law) rather than adding new top-level fields.

### 5.4 Connecting to the DB

Every API route handler must call `await connectDb()` before touching a model. The function is idempotent and cached globally; calling it repeatedly is cheap.

```ts
import { connectDb } from '@/lib/db/connect';

export async function GET(req: NextRequest) {
  await connectDb();
  // ... query models
}
```

If you forget, queries silently hang in serverless environments — annoying to debug.

---

## 6. Authentication and access enforcement

### 6.1 The three layers

1. **Edge middleware** (`/middleware.ts`) — redirects unauthenticated users to `/login`, blocks non-admin from `/settings/*` based on JWT claims. No DB hits.
2. **API route wrapper** (`withAuth`) — verifies session, hydrates the user from DB (so role/status changes take effect immediately), establishes request context.
3. **Query scoping** (`scopedQuery`) — applied to every DB query to enforce BU isolation.

### 6.2 Writing a protected API route

Every protected route uses `withAuth`. Admin-only routes pass `{ adminOnly: true }`. Example:

```ts
import { withAuth } from '@/lib/auth/withAuth';
import { scopedQuery } from '@/lib/auth/scopedQuery';
import { Lead } from '@/lib/models/Lead';

export const GET = withAuth(async (req, ctx, { user }) => {
  const bu = req.nextUrl.searchParams.get('businessUnit');
  const filter = scopedQuery(user, bu);
  const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(50);
  return apiOk({ data: leads });
});

export const POST = withAuth(async (req, ctx, { user }) => {
  const body = leadCreateSchema.parse(await req.json());
  // Enforce BU access on create too
  if (!user.isAdmin && !user.businessUnits.includes(body.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }
  const lead = await Lead.create({ ...body, createdBy: user._id, updatedBy: user._id });
  return apiOk({ data: lead }, 201);
});
```

`withAuth` also runs the handler inside `runWithContext()` so the audit log plugin can find the current user. **Never call models outside a `withAuth` wrapper or seed script.** If you do, audit log entries will have `actorId: null` and `source: 'system'`, which is fine for seeds but wrong for user actions.

### 6.3 Single-document fetches

When fetching by ID, **always combine the ID with `scopedQuery()`** and return 404 (not 403) if not found — prevents ID enumeration across BUs:

```ts
// WRONG — leaks cross-BU records
const lead = await Lead.findById(id);

// RIGHT
const lead = await Lead.findOne({ _id: id, ...scopedQuery(user) });
if (!lead) return apiError('NOT_FOUND', 'Lead not found', 404);
```

### 6.4 Admin override

Admin bypasses BU scoping. The `scopedQuery()` helper handles this:

```ts
if (user.isAdmin) {
  return requestedBU && requestedBU !== 'all'
    ? { businessUnit: requestedBU, deletedAt: null }
    : { deletedAt: null };
}
```

Never special-case `if (user.isAdmin)` checks scattered in route code — it's all in `scopedQuery`.

---

## 7. API conventions

### 7.1 Routing

REST-ish. Predictable patterns make life easier:

```
GET    /api/leads                  → list with filters
POST   /api/leads                  → create
GET    /api/leads/:id              → detail
PUT    /api/leads/:id              → update (full replace semantics)
PATCH  /api/leads/:id              → partial update
DELETE /api/leads/:id              → soft delete
POST   /api/leads/:id/convert      → action endpoint
```

Sub-resources mirror the relationship: `GET /api/cases/:id/checklist`, `GET /api/contacts/:id/invoices`.

### 7.2 Response shape

**Every** API response uses this shape, via the `apiOk` / `apiError` helpers:

```ts
// Success
{ success: true, data: T, meta?: { page, limit, total } }

// Error
{ success: false, error: { code: string, message: string, details?: any } }
```

HTTP status codes match: 200/201 for success, 400 validation, 401 auth, 403 forbidden, 404 not found, 500 server error.

### 7.3 List endpoint query params (standard set)

Every list route accepts:

```
?page=1&limit=25                    pagination (limit capped at 100)
&sort=createdAt:desc                sort field + direction
&businessUnit=law|all               BU filter
&assignedTo=<userId>                assignee filter
&search=<text>                      text search
&smartListId=<id>                   apply saved filter
&includeDeleted=true                admin-only, requires query option
```

Build a shared `parseListQuery(req)` helper in `/lib/utils/parseListQuery.ts`. Use it in every list route. Don't reinvent.

### 7.4 Validation

Every POST/PUT/PATCH body **must** be validated with a Zod schema before touching the DB. Validation lives in `/lib/utils/validators/<resource>.ts`:

```ts
// lib/utils/validators/lead.ts
import { z } from 'zod';
import { LEAD_STAGES, LEAD_SOURCES } from '@/lib/constants/enums';

export const leadCreateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  source: z.enum(LEAD_SOURCES).default('other'),
  stage: z.enum(LEAD_STAGES).default('new_inquiry'),
  businessUnit: z.string().min(1),
  assignedTo: z.string().nullable().optional(),
});
```

Throw on parse failure → catch in `withAuth` wrapper → return 400 with `details`.

### 7.5 Pagination

Default `limit=25`, hard cap at `100`. Use cursor pagination (`?cursor=<lastId>`) for endpoints that hit > 10k records (audit log, messages). Use offset (`?page=N`) for everything else.

### 7.6 Webhooks

Live under `/api/webhooks/<provider>`. **No `withAuth` — verify provider signature instead**:

- SendGrid: ECDSA public key verification
- Twilio: HMAC-SHA1 with auth token
- WhatsApp: HMAC-SHA256 with app secret
- Stripe (Phase 2): HMAC-SHA256 with webhook secret

Signature check happens **first**, before any parsing. Webhooks run inside `runWithContext({ user: null, source: 'webhook' })` so audit logs are tagged correctly.

---

## 8. Frontend conventions

### 8.1 Data fetching

Use **TanStack Query**. One hook per resource in `/hooks/`:

```ts
// hooks/useLeads.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => fetch(`/api/leads?${toQuery(filters)}`).then(r => r.json()),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => fetch(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onMutate: async ({ id, patch }) => {
      // Optimistic update — critical for Kanban drag-drop UX
      await qc.cancelQueries({ queryKey: ['leads'] });
      const prev = qc.getQueryData(['leads']);
      qc.setQueryData(['leads'], (old: any) => /* apply patch */);
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['leads'], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}
```

**Don't** use raw `useEffect + fetch` for anything beyond one-off pages.

### 8.2 Business Unit selector

Lives in the header. State stored in a React context, persisted in `localStorage`. Every TanStack Query hook includes the current BU in its query key so switching BUs refetches:

```ts
const { currentBU } = useBusinessUnit();
useQuery({ queryKey: ['leads', currentBU, otherFilters], ... });
```

When admin or no BU is selected (`currentBU === 'all'`), the API returns all BUs the user can access.

### 8.3 Permission-aware UI

Since there are no permissions, just two helpers:

```ts
const { isAdmin, businessUnits, canAccessBU } = useCurrentUser();

{isAdmin && <SidebarItem to="/settings">Settings</SidebarItem>}
{canAccessBU('law') && <BUTab bu="law" />}
```

That's it. No `usePermission('leads:edit')` — we deleted that infrastructure.

### 8.4 Loading and empty states

Every list view must handle three states explicitly: loading skeleton, empty state with a CTA, populated. Don't render blank cards on loading — use the `<Skeleton>` component from `/components/ui/`.

### 8.5 Forms

- Use **react-hook-form** with Zod resolver — share the validator with the API where possible.
- Never use HTML `<form>` inside Artifacts. (Doesn't apply here, this is a real Next.js app — `<form>` is fine.)
- Submit buttons disable on pending. Show toast on error/success via the project's `toast()` helper.

---

## 9. Lead → Case conversion (canonical complex flow)

This is the most complex business flow. It's the reference example for "how to do multi-collection writes."

```ts
// POST /api/leads/:id/convert
import { connectDb } from '@/lib/db/connect';
import mongoose from 'mongoose';

export const POST = withAuth(async (req, ctx, { user }) => {
  await connectDb();
  const { id } = ctx.params;
  const body = convertLeadSchema.parse(await req.json());

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const lead = await Lead.findOne({ _id: id, ...scopedQuery(user) }).session(session);
      if (!lead) throw new NotFoundError('Lead not found');
      if (lead.stage === 'converted') throw new ConflictError('Already converted');

      // 1. Create contact (client)
      const contact = await Contact.create([{
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        contactType: 'client',
        businessUnit: lead.businessUnit,
        createdBy: user._id,
        updatedBy: user._id,
      }], { session });

      // 2. Create case
      const caseNumber = await generateCaseNumber(lead.businessUnit, session);
      const newCase = await Case.create([{
        caseNumber,
        title: body.caseTitle,
        clientId: contact[0]._id,
        caseType: body.caseType,
        businessUnit: lead.businessUnit,
        convertedFromLead: lead._id,
        assignedTo: body.assignedTo ?? lead.assignedTo,
        createdBy: user._id,
        updatedBy: user._id,
      }], { session });

      // 3. Update lead
      lead.stage = 'converted';
      lead.convertedToCase = newCase[0]._id;
      lead.convertedAt = new Date();
      lead.updatedBy = user._id;
      await lead.save({ session });

      result = { contact: contact[0], case: newCase[0], lead };
    });
    return apiOk({ data: result }, 201);
  } finally {
    await session.endSession();
  }
});
```

**Key points:**

- All three writes go through a transaction. MongoDB Atlas supports transactions (replica set required — Atlas default is OK).
- Audit log entries are written for all three (create contact, create case, update lead) automatically.
- We do **not** delete the lead after conversion — historical record matters.
- `generateCaseNumber()` uses a `Counter` collection with an atomic `$inc` to avoid duplicate case numbers under concurrent conversions.

---

## 10. Integrations

### 10.1 Pattern

Each integration lives in `/lib/integrations/<provider>.ts` and exposes a typed client interface. Real API in production, stub in dev unless `INTEGRATION_LIVE_<PROVIDER>=true`.

```ts
// lib/integrations/sendgrid.ts
export interface EmailClient {
  send(args: { to: string; subject: string; html: string; from?: string }): Promise<SendResult>;
}

export const emailClient: EmailClient =
  process.env.INTEGRATION_LIVE_SENDGRID === 'true'
    ? realSendGridClient
    : stubEmailClient;
```

Routes import the interface, never the SDK directly. Makes testing trivial.

### 10.2 Inbound webhooks

All providers' inbound webhooks resolve to the same logical flow:

1. Verify signature
2. Parse payload
3. Find or create `Contact` by email/phone
4. Find or create `Thread` for (contact, channel)
5. Append `Message` to thread
6. Bump thread `unreadCount`, `lastMessageAt`, `lastMessagePreview`
7. Write `Activity` entry if linked to a lead/case

Build a shared `ingestInboundMessage()` helper in `/lib/integrations/inbound.ts`. Each webhook just normalizes its provider's shape and calls the helper.

### 10.3 Secrets

Integration API keys and tokens are stored in the `settings` singleton document, **encrypted at rest** using AES-256-GCM with a key from `INTEGRATION_SECRET_KEY` env var. Never store as plaintext, even in dev. The `/lib/utils/encryption.ts` module handles encrypt/decrypt.

The reason: settings are user-editable in the admin UI; we don't want anyone with DB read access to see live API keys.

---

## 11. Environment variables

Required for any environment:

```
# Database
MONGODB_URI=mongodb+srv://...

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<32+ char random string>

# Encryption (for settings integration secrets)
INTEGRATION_SECRET_KEY=<32 char hex>

# AWS S3 (Documents)
AWS_REGION=ap-south-1
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Integration toggles (default off in dev)
INTEGRATION_LIVE_SENDGRID=false
INTEGRATION_LIVE_TWILIO=false
INTEGRATION_LIVE_WHATSAPP=false

# Audit log retention (optional, defaults to 180 days)
AUDIT_LOG_TTL_SECONDS=15552000
```

Document any new env var here and in `.env.example`.

---

## 12. Common pitfalls — read before debugging

- **"Queries return nothing after I deleted a record"** → soft-delete is working. Use `{ withDeleted: true }` to see deleted records.
- **"Audit log shows `actorId: null` for user actions"** → the route didn't go through `withAuth`, so no request context was set. Fix the route.
- **`OverwriteModelError`** → schema file isn't using the `mongoose.models.X ?? mongoose.model(...)` pattern. Fix the export.
- **"Connection pool exhausted on MongoDB Atlas"** → someone added `mongoose.connect()` outside `connectDb()`. Always import the cached helper.
- **"Aggregation returns deleted records"** → plugin doesn't reach aggregate. Use `withSoftDeleteMatch()` or add `$match` manually.
- **"User from another BU sees my records"** → a route used `findById` instead of `findOne({ _id, ...scopedQuery(user) })`. Fix it.
- **"Lead conversion partially succeeded"** → not using `session.withTransaction()`. Multi-collection writes MUST use transactions.
- **"Settings page crashes on non-admin user"** → middleware should redirect, but the page still needs an `if (!isAdmin) return null` guard.

---

## 13. Code style

- **TypeScript strict mode on.** No `any` unless commented why.
- **Async/await everywhere.** No `.then()` chains.
- **Named exports** for utilities. Default exports only for Next.js pages/layouts.
- **Imports ordered:** node built-ins → external packages → internal `@/lib` → internal `@/components` → relative.
- **File naming:** `PascalCase.ts` for models and React components, `camelCase.ts` for everything else.
- **Comments explain WHY, not WHAT.** The code shows what. If you need a comment to explain what, refactor instead.
- **Error messages are user-facing.** Don't expose stack traces or DB internals. Use the error classes in `/lib/utils/errors.ts`.

---

## 14. Build phases — what to do, in order

**Phase 0 (Week 1) — Foundation. Nothing else works without this.**

- [ ] Next.js project setup, `tsconfig`, Tailwind, lucide
- [ ] Port Figma Make components into `/components`
- [ ] MongoDB connection (`lib/db/connect.ts`)
- [ ] All Mongoose plugins (`softDelete`, `auditFields`, `auditLog`)
- [ ] Foundation models: `User`, `BusinessUnit`, `AuditLog`, `Settings`
- [ ] NextAuth setup with Credentials provider + JWT
- [ ] `requestContext` (AsyncLocalStorage)
- [ ] `withAuth` wrapper
- [ ] `scopedQuery` helper
- [ ] `middleware.ts` for auth gate
- [ ] Seed script that creates first admin user + 3 BUs
- [ ] Login page wired up, sidebar shell with BU selector

**Phase 1 (Weeks 2–4) — Spine CRUD.**

- [ ] `Contact`, `Lead`, `Case`, `CaseChecklist`, `PipelineStage` models
- [ ] All `/api/contacts/*`, `/api/leads/*`, `/api/cases/*` routes
- [ ] Lead → Case conversion (with transaction)
- [ ] List + Detail pages for each
- [ ] Dashboard with real metrics

**Phase 2 (Weeks 5–6) — Workflow.**

- [ ] `Task`, `Document`, `CalendarEvent`, `SmartList`, `Activity` models
- [ ] Pipeline Kanban with @dnd-kit + optimistic updates
- [ ] Documents upload with S3 signed URLs
- [ ] Smart Lists with filter-tree builder
- [ ] Calendar view

**Phase 3 (Weeks 7–9) — Communications & billing.**

- [ ] `Thread`, `Message`, `Invoice` models
- [ ] SendGrid integration (outbound + inbound)
- [ ] Twilio SMS integration
- [ ] WhatsApp integration (if Meta approval came through)
- [ ] Unified inbox UI with polling
- [ ] Invoice create/send (no Stripe in Phase 1)

**Phase 4 (Weeks 10–12) — Settings, admin tools, polish.**

- [ ] Settings module (users, BUs, integrations, AI config stub)
- [ ] Audit Log admin viewer
- [ ] AI Assistant UI stub
- [ ] Bug fixes, performance pass, deploy

---

## 15. When in doubt

- **Re-read this file** before asking for instructions.
- **Look at how an existing model/route does it** before inventing a new pattern.
- **Prefer simplicity** over flexibility — we deliberately stripped out roles and permissions. Apply the same instinct elsewhere.
- **If a feature requires bypassing audit log, soft delete, or scoped queries** — stop and discuss before writing code. Those guardrails exist for a reason.
- **Update this file** when conventions change. It rots fast if no one tends it.
