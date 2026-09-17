# Adziga — AI-first Advertising & Marketing Operating System

Production-grade implementation of the Adziga spec (ADZIGA22).

This is **not** a marketing website. It is a multi-tenant Marketing Operating
System with every module from the spec implemented end-to-end.

## What's inside

### Public surface
- `/` — public marketing site (preserves the adziga.in identity, adds Adziga flywheel, tier comparison, integrations, roadmap, phases)
- `/login` — credentials sign-in
- `/onboarding` — 10-step structured onboarding wizard (spec §39)

### Authenticated app (`/app/*`) — 14 modules + admin
1. **Overview** — KPI command center with funnel, period filter, alerts, daily chart
2. **Clients** — full client accounts with contracts, contacts, full activity timeline
3. **Campaigns** — multi-channel workflow: Draft → Internal Review → Client Approval → Ready → Active → Paused → Completed → Archived
4. **Strategy** — versioned, human-controlled strategies with author/approver/change-reason/version chain
5. **Creatives** — creative library with hook/headline/copy/CTA/creator/format + performance metrics
6. **Leads** — full lifecycle (NEW → CONTACTED → QUALIFIED → MEETING_SCHEDULED → PROPOSAL → WON/LOST), pipeline counts, full attribution
7. **CRM** — active pipeline + converted customers, preserving originating lead + attribution
8. **Events** — online + offline with full funnel (Promotion → Registration → Attendance → Consultation → Conversion)
9. **Influencers** — creator roster with unique tracking tokens, ROI, attribution
10. **Experiments** — hypothesis-driven A/B with control/treatment/expected/actual/conclusion
11. **Analytics** — unified metrics with platform breakdown, daily chart, source breakdown, period filter
12. **Reports** — full client-facing sections (Executive Summary / Performance / Campaign Analysis / Funnel / Lead Quality / Creatives / Recommendations / Next Actions)
13. **AI Assistant** — controlled-context Q&A with audit trail. **Does NOT execute changes** (spec §0 — no fake AI)
14. **Automations** — trigger + conditions + actions workflow engine

Plus:
- **Requests** — client-submitted requests with status flow
- **Tasks** — internal kanban (TODO / IN_PROGRESS / BLOCKED / DONE)
- **Decisions** — hypothesis-driven decision log (foundation for future intelligence)
- **Notifications** — in-app with type/channel/read state
- **Admin** — operator command center
- **Audit** — full audit trail grouped by entity
- **Integrations** — Meta, Google, WhatsApp, Gemini, TikTok, LinkedIn, Vertex AI, BigQuery, Firebase health
- **Billing** — plans, subscriptions, invoices (separate from ad spend, per spec §38)

### RBAC (10 roles)
- SUPER_ADMIN, FOUNDER, ADMIN, MARKETING_MANAGER, CAMPAIGN_MANAGER, SALES, FINANCE, CONTENT, CLIENT_ADMIN, CLIENT_MEMBER
- Each role gets its own sidebar nav (operator vs client portal)

### Tiers
- FREE — Marketing Companion AI
- PRO — Execution + automation
- ZIGA_PLUS — Enterprise orchestration

### Multi-tenancy
- `Organization` is the tenant boundary
- Every business entity carries `orgId` + tenant-isolated queries
- Each membership has a role; JWT carries memberships + active org
- Client orgs (Acme, FinRise) are demo tenants

### API (REST, /api/*)
- `/api/auth/*` — NextAuth handlers
- `/api/search` — global search across clients, campaigns, leads, creatives, events, influencers
- `/api/ai/ask` — assistant with controlled context
- `/api/onboarding` — wizard submission

## Stack
- Next.js 14 App Router, server components + server actions
- TypeScript strict
- Prisma + SQLite (dev) / PostgreSQL-ready
- NextAuth v5 (credentials provider, bcrypt, JWT sessions)
- Tailwind + custom CSS for "Marketing Command Center" B2B feel

## Run locally

```bash
npm install
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
npm run build
npm start
```

Open http://localhost:3000

## Demo logins (seed)

| Email | Password | Role |
|-------|----------|------|
| super@adziga.in | adziga123 | Super Admin (full system) |
| founder@adziga.in | adziga123 | Founder |
| admin@adziga.in | adziga123 | Admin |
| mm@adziga.in | adziga123 | Marketing Manager |
| cm@adziga.in | adziga123 | Campaign Manager |
| sales@adziga.in | adziga123 | Sales |
| finance@adziga.in | adziga123 | Finance |
| content@adziga.in | adziga123 | Content |
| client@acme.in | adziga123 | Client Admin (Acme Realty) |
| client@finrise.in | adziga123 | Client Admin (FinRise) |

## What was intentionally not built
Per spec §0 — **no fake AI.** The AI Assistant:
- Has controlled context (only what the request authorizes)
- Never executes changes autonomously
- Honestly tells the user when it can't do something
- Suggests using the Requests feature for actions
- Logs every interaction to `AIInteraction` for audit

Future phases (per spec):
- Phase 1 — deeper integrations with Meta/Google/WhatsApp connectors
- Phase 2 — Strategy Intelligence engine (industry × audience × budget)
- Phase 3 — Content Intelligence (hook → conversion correlation)
- Phase 4 — Marketing orchestration with approval gates

## Architecture decisions

- **SQLite for dev, PostgreSQL-ready** — schema uses standard Prisma types
- **Server components** by default; client components only for stateful interactions
- **Server actions** for all mutations — no separate API routes for CRUD
- **RBAC** enforced both in `navRoutesForRole` (UI) and `canAccess` (server-side)
- **Audit log** on every meaningful mutation
- **Strategy versioning** with parent → child chain (foundation for training data)
- **Decision log** captures hypothesis → actual outcome → evaluation
- **Multi-tenant** orgId on every entity, query-time filtering
- **AI boundary** — `ai.ts` receives only the controlled context, never raw DB

## Files

```
prisma/
  schema.prisma        — 25+ entities, normalized, tenant-isolated
  seed.ts              — full realistic dataset covering every module
src/
  app/
    page.tsx           — public marketing site
    login/, onboarding/ — auth + structured onboarding
    app/               — authenticated app (14 modules + admin)
    api/               — REST endpoints
  lib/
    db.ts              — Prisma client singleton
    auth.ts            — NextAuth config + multi-tenant JWT
    session.ts         — server-side helpers (requireSession, audit)
    constants.ts       — TS-level enums (since SQLite has no enums)
    format.ts          — INR/lakh/crore formatters, KPI helpers
    ai.ts              — controlled-context assistant
  app/globals.css      — Tailwind + custom design tokens
```