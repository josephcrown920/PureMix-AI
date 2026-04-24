# MasterAI — AI Music Mastering SaaS

A SaaS app that takes user audio uploads and returns mastered tracks using a Python audio pipeline. Frontend deploys to Netlify; API + Python worker stay on Replit.

## Architecture

- **artifacts/music-mastering** — React + Vite frontend (Ocean dark theme)
- **artifacts/api-server** — Express API server, also proxies to Vite in dev and serves static frontend in prod
- **artifacts/api-server/src/lib/audioMastering.py** — Python worker invoked by `masteringProcessor.ts`
- **lib/db** — Shared Drizzle schema (Postgres). Tables: `users`, `mastering_jobs`
- **lib/api-client-react** — Generated API client (orval) + customFetch with bearer-token support

## Auth & Billing

- **Clerk** is the auth provider. Sign-in/up at `/sign-in/*?` and `/sign-up/*?`. The Clerk JWT is sent on every API request via `Authorization: Bearer <token>` (configured in `src/lib/api-client-config.ts`).
- **Paystack** handles billing. Three plans (USD by default, override with `PAYSTACK_CURRENCY`):
  - `free` — 3 masters/month
  - `pro` — $9.99/month, unlimited (Paystack subscription, plan auto-created on first checkout)
  - `lifetime` — $99 one-time, unlimited
- The Pro Paystack plan is created lazily on first checkout (`ensurePaystackPlan`) and cached. Override the lookup with `PAYSTACK_PLAN_CODE_PRO`.

### Endpoints
- `GET /api/me` — current user, plan, this-month usage
- `GET /api/billing/plans` — public plan catalogue
- `POST /api/billing/checkout` `{ plan, returnUrl }` → returns `authorizationUrl`
- `GET /api/billing/verify?reference=...` — called after the user returns from Paystack
- `POST /api/billing/cancel` — disables Pro subscription (user keeps Pro until period ends; downgrade happens via webhook)
- `POST /api/webhooks/paystack` — HMAC-SHA512 verified using `PAYSTACK_SECRET_KEY`

### Required env vars
- API server (Replit): `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `PAYSTACK_SECRET_KEY`, optional `PAYSTACK_CURRENCY`, `PAYSTACK_PLAN_CODE_PRO`, `FRONTEND_ORIGINS` (comma-separated, required in production)
- Frontend (Netlify): `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_API_BASE_URL` (URL of the Replit API server)

## Database

`users` (id = Clerk userId, email, plan, lifetime, paystackCustomerCode, paystackSubscriptionCode, paystackEmailToken, proRenewsAt, createdAt, updatedAt)

`mastering_jobs` (… + nullable `user_id`, nullable `session_id` for legacy rows). All mastering routes filter by `req.userId` from `requireAuth`, which auto-upserts the user row on first call.

To sync schema: `pnpm --filter @workspace/db run push-force`

## Deployment

- **Frontend → Netlify**: `artifacts/music-mastering/netlify.toml` is configured. Set the three `VITE_*` env vars in Netlify and connect the repo. Build runs from the monorepo root.
- **API + worker → Replit**: keep the existing workflow. Set the Paystack webhook URL in the Paystack dashboard to `https://<replit-domain>/api/webhooks/paystack`.

## Important wiring details

- `app.use("/api/webhooks/paystack", express.raw(...), webhookRouter)` is mounted **before** `express.json()` so HMAC verification sees the raw body. Other `/api` routes get JSON parsing as normal.
- The api-client-react `setAuthTokenGetter` is wired by `<ApiAuthBridge />` mounted inside `ClerkProvider`. It uses bearer tokens (not cookies) because the frontend and API live on different origins in production.
- CORS is permissive in dev, but in production (`NODE_ENV=production`) only `FRONTEND_ORIGINS` plus `*.replit.dev` / `localhost` are allowed.
- Tailwind v4 + Clerk shadcn theme: `@layer theme, base, clerk, components, utilities;` is declared **before** `@import "tailwindcss"`, and `tailwindcss({ optimize: false })` is used in `vite.config.ts` so Clerk's CSS layer ordering survives the build.

## Known limitations / future work

- Monthly job-limit enforcement uses a count + insert; under heavy concurrency a user could squeeze in over the cap. Acceptable for the current scale.
- Webhook handler is idempotent for the events we care about but does not store event IDs, so we have no replay protection beyond Paystack's signature.
