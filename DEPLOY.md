# Adziga — Deployment Guide

This document covers deploying Adziga to production. Pick the option that matches your infrastructure.

---

## Quick comparison

| Platform | Cost | Time to deploy | Best for |
|---|---|---|---|
| **Hostinger VPS** (Docker) | ~₹299/mo | ~30 min | Full control, Indian data residency |
| **Vercel** | Free tier available | ~5 min | Fastest, automatic CI/CD |
| **Railway** | $5 free credit/mo | ~10 min | Postgres + app together |
| **Netlify** | Free tier available | ~10 min | Static + edge functions |
| **Self-hosted (PM2 + Nginx)** | Server cost | ~45 min | Maximum control |

---

## Option 1 — Hostinger VPS (recommended for production in India)

Hostinger VPS gives you a dedicated Ubuntu server with root access.

### 1.1 Provision VPS
- Plan: KVM 1 or higher (≥2 GB RAM, ≥40 GB SSD)
- OS: Ubuntu 22.04 LTS
- Datacenter: Choose closest to your users (BOM1 for India)

### 1.2 Install Docker
```bash
ssh root@YOUR_VPS_IP
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
```

### 1.3 Clone and configure
```bash
git clone https://github.com/SaiNihal2622/adziga-marketing-os.git
cd adziga-marketing-os

# Generate secrets
openssl rand -base64 32   # → NEXTAUTH_SECRET / AUTH_SECRET
openssl rand -base64 32   # → MFA_ENCRYPTION_KEY
openssl rand -hex 16      # → META_WEBHOOK_VERIFY_TOKEN
```

Create `.env.production` from `.env.example` and fill in real secrets. Then:
```bash
cp .env.example .env.production
nano .env.production
```

### 1.4 Add Hostinger firewall rule for the webhook endpoints
In Hostinger panel → VPS → Firewall, allow inbound:
- 80/tcp, 443/tcp (HTTP/HTTPS)
- 22/tcp (SSH)

### 1.5 Add Postgres + Redis if you need them, or use Hostinger's managed DB.

### 1.6 Deploy with docker-compose
```bash
docker compose -f docker-compose.yml --env-file .env.production up -d --build
docker compose logs -f adziga
```

### 1.7 Set up TLS with Caddy (auto-renews Let's Encrypt certs)

```bash
apt install -y caddy
cat > /etc/caddy/Caddyfile <<EOF
adziga.in {
  reverse_proxy localhost:3000
  encode gzip
}

app.adziga.in {
  reverse_proxy localhost:3000
  encode gzip
}
EOF
systemctl restart caddy
```

### 1.8 Point DNS
- A record: `adziga.in` → VPS IP
- A record: `app.adziga.in` → VPS IP
- A record: `*.adziga.in` → VPS IP (for tenant subdomains — `acme.adziga.in`)

### 1.9 Configure Razorpay webhooks
In Razorpay Dashboard → Webhooks, add:
- URL: `https://adziga.in/api/webhooks/razorpay`
- Active events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `invoice.paid`, `payment.failed`
- Secret: copy value from `.env.production` `RAZORPAY_WEBHOOK_SECRET`

### 1.10 Configure Meta webhooks
In Meta App Dashboard → Webhooks, add:
- URL: `https://adziga.in/api/webhooks/meta`
- Verify token: copy value from `META_WEBHOOK_VERIFY_TOKEN`
- Subscription fields: `leadgen`

---

## Option 2 — Vercel (5 minutes)

### 2.1 One-time setup
```bash
npm i -g vercel
vercel login
```

### 2.2 Link project
```bash
cd adziga-marketing-os
vercel link
```

### 2.3 Add env vars
Vercel dashboard → Settings → Environment Variables. Paste everything from `.env.example`. Critical ones:
- `DATABASE_URL` — use Vercel Postgres or external Postgres
- `NEXTAUTH_SECRET`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY` — strong random strings
- `NEXTAUTH_URL`, `APP_URL` — `https://adziga.in`

### 2.4 Add Vercel Postgres (or external)
Vercel dashboard → Storage → Create Database → Postgres. Copy `DATABASE_URL`.

### 2.5 Deploy
```bash
vercel --prod
```

### 2.6 Configure webhook URLs
Vercel will give you a URL like `adziga-marketing-os.vercel.app`. Configure Razorpay + Meta webhooks to point at the production URL.

---

## Option 3 — Railway (10 minutes)

### 3.1 Install CLI
```bash
npm i -g @railway/cli
railway login
```

### 3.2 Create project
```bash
cd adziga-marketing-os
railway init
```

### 3.3 Add Postgres
```bash
railway add --plugin postgresql
railway variables  # copy DATABASE_URL
```

### 3.4 Set env vars
```bash
railway variables set NEXTAUTH_SECRET=$(openssl rand -base64 32)
railway variables set AUTH_SECRET=$(openssl rand -base64 32)
railway variables set MFA_ENCRYPTION_KEY=$(openssl rand -base64 32)
railway variables set APP_URL=https://adziga.up.railway.app
# ... (set the rest from .env.example)
```

### 3.5 Deploy
```bash
railway up
```

---

## Option 4 — Netlify (10 minutes)

### 4.1 One-time setup
```bash
npm i -g netlify-cli
netlify login
```

### 4.2 Link + deploy
```bash
cd adziga-marketing-os
netlify link
netlify env:set NEXTAUTH_SECRET $(openssl rand -base64 32)
# ... (set all required env vars)
netlify deploy --prod
```

Note: Netlify requires an external Postgres (Neon, Supabase, etc.) since it doesn't provide managed databases.

---

## Post-deploy verification

After deploying, run these smoke tests:

```bash
curl -fsS https://adziga.in/                       # Marketing site
curl -fsS https://adziga.in/login                  # Login page
curl -fsS https://adziga.in/signup                 # Signup page
curl -fsS https://adziga.in/api/auth/signup \
  -X POST -H 'content-type: application/json' \
  -d '{"email":"demo@adziga.in","password":"adziga123","name":"Demo","orgName":"Demo Co"}'
# → 200 OK with userId and orgId
```

Then visit `https://adziga.in/signup` in a browser and complete the signup → verify email → onboarding flow.

---

## Observability

### Sentry (recommended)
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```
Set `SENTRY_DSN` in your env. Errors will be captured with full stack traces.

### Health endpoint
The app exposes `GET /` which returns 200 if the server is alive. Point your monitoring at this URL with a 30-second interval.

### Database backups
For Hostinger: `pg_dump` cron job to S3 (recommended daily).
For managed Postgres (Vercel/Railway/Neon): backups are included.

---

## Scaling

| Component | Single server | Scale-out |
|---|---|---|
| Next.js app | 1 container | Add instances behind load balancer |
| Postgres | Single primary | Add read replicas, PgBouncer |
| Email | SMTP/Resend | Already external |
| File uploads | Local volume | Move to S3/R2 |
| Background jobs | In-process | Move to BullMQ + Redis |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| 500 on /login | Check `NEXTAUTH_SECRET` and `AUTH_SECRET` are set; rebuild |
| Stripe webhook 400 | Verify webhook secret matches dashboard |
| Meta webhook 403 | Check `META_WEBHOOK_VERIFY_TOKEN` matches dashboard |
| Email not arriving | Switch `EMAIL_PROVIDER` from `stub` to `smtp` or `resend` |
| 401 on protected API | Session expired — re-login; check `NEXTAUTH_URL` matches domain |
| Build fails with Prisma error | Run `npx prisma generate` locally; commit `prisma/migrations/` |
