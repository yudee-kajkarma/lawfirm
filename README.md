# CRM Platform

Multi-tenant internal CRM for Immigration, Law, and Wealth business units. Built with Next.js, MongoDB, and TypeScript.

> **For AI assistants (Claude Code, Cursor, etc.):** read `CLAUDE.md` first. It contains all project conventions and patterns.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in MONGODB_URI, NEXTAUTH_SECRET, AWS keys, etc.

# 3. Seed the database (creates first admin user + 3 business units)
npm run seed

# 4. Start dev server
npm run dev
```

App runs at <http://localhost:3000>. Log in with the credentials printed by the seed script.

---

## Documentation map

| File | Purpose | Audience |
|---|---|---|
| `CLAUDE.md` | Conventions, patterns, architecture | AI assistants + developers |
| `README.md` | Setup and quick reference | Humans |
| `PRD_LAW.md` | Full product requirements | Stakeholders |
| `/docs/api.md` | API endpoint reference *(coming)* | API consumers |
| `/docs/data-model.md` | Database schema reference *(coming)* | Developers |

---

## Tech stack

- **Next.js 14+** (App Router) with TypeScript
- **MongoDB** (Atlas) with Mongoose ODM
- **NextAuth.js** for authentication
- **TanStack Query** for client-side data fetching
- **Tailwind CSS** + Lucide icons
- **AWS S3** for document storage
- **SendGrid / Twilio / WhatsApp Business** for communications

---

## Project structure

```
/app          Next.js pages (App Router) and API routes
/components   React components (Figma Make exports + ours)
/lib
  /db         MongoDB connection and Mongoose plugins
  /models     Schema definitions
  /auth       NextAuth, request context, query scoping
  /utils      Validators, error classes, helpers
  /constants  Enums shared across schemas
/hooks        Client-side React hooks
/scripts      Seed scripts, one-off migrations
```

See `CLAUDE.md` Section 4 for the full breakdown.

---

## Available scripts

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run seed         # Seed database with initial data
npm run seed:reset   # Drop + reseed (DEV ONLY)
```

---

## Environment variables

See `.env.example` for the full list. Required for first run:

- `MONGODB_URI` — MongoDB Atlas connection string
- `NEXTAUTH_URL` — typically `http://localhost:3000` in dev
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `INTEGRATION_SECRET_KEY` — generate with `openssl rand -hex 16`

S3 and integration keys (SendGrid/Twilio/WhatsApp) can be added later via the Settings UI.

---

## Access model

Two-tier:

- **Admin** (`isAdmin: true`) — full access across all business units, plus settings management
- **Standard user** — full access within the business units assigned to them; no settings access

No roles, no per-resource permissions. Every action is audit-logged.

See `CLAUDE.md` Section 3.2 for the rationale.

---

## Business unit segregation

Every business-facing record belongs to one of: `immigration`, `law`, `wealth` (or custom BUs created by admin). Users see only data from BUs they're assigned to. The BU dropdown in the header switches the active view.

Enforcement is at the **query layer**, not the UI. See `CLAUDE.md` Section 3.1 and 6.2.

---

## Audit log

Every create / update / delete on every business record is logged automatically with:

- Actor (user) + IP + user-agent
- Field-level diff (before / after)
- Timestamp
- Business unit

Admin views the log under Settings → Audit Log. Entries auto-delete after 180 days (configurable via `AUDIT_LOG_TTL_SECONDS`).

---

## Contributing

1. Read `CLAUDE.md` end to end before writing code.
2. Follow the patterns in existing models and routes.
3. New schemas must apply `softDeletePlugin`, `auditFieldsPlugin`, and `auditLogPlugin`.
4. Every protected API route uses `withAuth()` and `scopedQuery()`.
5. Run `npm run typecheck && npm run lint` before pushing.

---

## License

Proprietary — internal use only.
