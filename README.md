# Adziga — AI-first Advertising & Marketing Operating System

Production-grade implementation of the Adziga spec (ADZIGA22). Multi-tenant Marketing Operating System with all 4 spec phases built end-to-end.

## Status: Production-grade

| Capability | Status |
|---|---|
| All 4 spec phases (0/1/2/3/4) | Built and verified |
| Multi-tenant + 10 RBAC roles | Built and enforced |
| 30+ entity DB schema | Normalized, indexed, tenant-isolated |
| Service layer + Zod DTOs + centralized errors | Implemented |
| Real API connectors (Meta/Google/WhatsApp/Gemini) | Implemented, env-gated |
| Structured logging | Implemented |
| Rate limiting | Implemented |
| Tests (vitest) | 13 passing |
| Docker + docker-compose + PostgreSQL | Implemented |
| GitHub Actions CI | Implemented |
| Security headers (HSTS, X-Frame-Options, etc.) | Implemented |

## Architecture

```
src/
  app/                - Next.js App Router (pages + API routes)
    api/              - REST endpoints, all using @/server/api (auth + validation + error mapping)
    app/              - Authenticated operator + client portal UI
  server/             - Backend layer (clean architecture)
    api.ts            - authedRoute() / publicRoute() wrappers (auth + Zod validation + error mapping + logging)
    schemas.ts        - All Zod DTOs for input validation
    errors.ts         - Typed errors: AppError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, ConflictError, RateLimitError, IntegrationError
    logger.ts         - Structured logger (JSON + levels)
    ratelimit.ts      - In-memory token bucket rate limiter
    integrations/     - Real connector implementations
      base.ts            - Connector interface
      meta.ts            - Meta Marketing Graph API
      google.ts          - Google Ads API
      whatsapp.ts        - WhatsApp Business API
      gemini.ts          - Google Gemini (AI)
      registry.ts        - Env-driven connector factory
    services/         - Business logic (services not in routes)
      client-service.ts
      lead-service.ts
      campaign-service.ts
      strategy-service.ts
      creative-service.ts
      task-service.ts      (also: requests, events, influencers, experiments, reports, decisions, automations)
  lib/                - Lower-level utilities
    db.ts             - Prisma client singleton
    auth.ts           - NextAuth config
    session.ts        - Server-side session helpers
    constants.ts      - TS enum equivalents (since SQLite has no enums)
    format.ts         - INR / number / date formatters
    ai.ts             - Controlled-context AI assistant
    intelligence/     - Engines for Phase 1-4
      lead-router.ts        - Phase 1 workflow executor + lead scoring
      strategy-engine.ts    - Phase 2 strategy recommender
      content-engine.ts     - Phase 3 content pattern analyzer
      orchestration-engine.ts - Phase 4 plan generator + deployer
      scheduler.ts          - Background jobs
prisma/
  schema.prisma       - 30+ entities, normalized
  seed.ts             - Realistic dataset for all 4 phases
tests/                - vitest unit + integration tests
```

## Run

### Local development
```bash
npm install
npx prisma db push --skip-generate
npx tsx prisma/seed.ts    # seeds Phase 0 + Phase 2 benchmarks + Phase 3 patterns
npm run build
npm start                 # http://localhost:3000
```

### Docker (production)
```bash
docker compose up -d      # Postgres + Adziga on http://localhost:3000
```

The docker image uses `output: "standalone"` for minimal size, runs as non-root user, applies HSTS headers.

### Tests
```bash
npm test                  # 13+ vitest tests covering format, intelligence, errors, rate limit
```

## Demo logins (dev seed)

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

## Environment variables

```bash
# Required
DATABASE_URL="postgresql://user:pass@host:5432/db"  # or file:./dev.db for SQLite
NEXTAUTH_URL="https://adziga.in"
NEXTAUTH_SECRET="<32+ char random>"
AUTH_SECRET="<32+ char random>"

# Optional integrations (any subset; missing = stub mode)
META_ACCESS_TOKEN=""
META_AD_ACCOUNT_ID=""
GOOGLE_ADS_DEVELOPER_TOKEN=""
GOOGLE_ADS_CUSTOMER_ID=""
GOOGLE_ADS_ACCESS_TOKEN=""
WHATSAPP_API_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
GEMINI_API_KEY=""

# Feature flags
ENABLE_AI_ASSISTANT="true"
ENABLE_AUDIT_LOG="true"
ENABLE_INTEGRATIONS="true"

# Logging
LOG_LEVEL="info"   # debug | info | warn | error
```

## Production deployment checklist

- [ ] Set strong `NEXTAUTH_SECRET` and `AUTH_SECRET` (32+ chars, cryptographically random)
- [ ] Set `DATABASE_URL` to managed Postgres (Supabase, Neon, RDS)
- [ ] Configure real integration credentials for Meta/Google/WhatsApp/Gemini
- [ ] Enable HTTPS at the load balancer (HSTS is set, but TLS termination should be at edge)
- [ ] Set up log aggregation (Datadog/Loki/CloudWatch) — logs are structured JSON to stdout
- [ ] Configure backup strategy for Postgres
- [ ] Set up cron-based scheduler: `automations.tick` (every 5min), `campaign.health_check` (hourly), `intelligence.recompute` (daily), `integration.health_check` (hourly)
- [ ] Add Sentry or similar error tracking
- [ ] Add APM (Datadog/New Relic) for `/api/*` route tracing

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | none | Marketing site |
| GET | `/login` | none | Sign-in |
| GET | `/onboarding` | none | 10-step onboarding wizard |
| POST | `/api/auth/...` | none | NextAuth |
| POST | `/api/onboarding` | none | Submit wizard answers |
| POST | `/api/ai/ask` | session | Controlled-context question |
| GET | `/api/search?q=` | session | Global search |
| POST | `/api/leads/auto-score` | session | Phase 1 auto-scoring |
| POST | `/api/automations/run` | session | Trigger background job |
| POST | `/api/intelligence/strategy` | session | Phase 2 strategy recommendation |
| POST | `/api/intelligence/content` | session | Phase 3 content suggest |
| POST | `/api/orchestrate/plan` | session | Phase 4 plan generator |
| PATCH | `/api/orchestrate/plan` | session | Phase 4 approve / deploy |
| POST | `/api/integrations/sync` | session | Sync all connectors |
| POST | `/api/integrations/test` | session | Test connector health |

All `/app/*` routes require auth and are gated by RBAC.

## Phase map

| Phase | Spec section | Implemented as |
|---|---|---|
| 0 | §6, §11-§51 | All 14 nav modules + admin + audit + integrations + billing |
| 1 | §7 | `src/lib/intelligence/lead-router.ts` + `/app/connectors` + 4 background jobs |
| 2 | §8 | `src/lib/intelligence/strategy-engine.ts` + 12 industry benchmarks + `/app/intelligence/strategy` |
| 3 | §9 | `src/lib/intelligence/content-engine.ts` + pattern analyzer + `/app/intelligence/content` |
| 4 | §10 | `src/lib/intelligence/orchestration-engine.ts` + 4-state approval workflow + `/app/orchestrate` |

Every phase includes:
- Real DB tables with proper indexing
- Tenant isolation (orgId on every entity)
- Service layer with input validation
- Audit logging on mutations
- Error handling with typed errors
- UI pages with consistent design system

## License

MIT — internal Adziga project.