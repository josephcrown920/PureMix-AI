# Puremix.ai — AI Music Mastering SaaS

## UI Theme

**Purple Dusk** — deep dark purple (`hsl(265 40% 7%)`) background with violet primary (`hsl(270 85% 68%)`) and pink/magenta accent (`hsl(300 70% 65%)`). All hardcoded shadow colors, glow effects, and Clerk auth UI use the same purple palette.

Afrobeats-focused AI mastering SaaS. Upload an audio track, get a release-ready master in seconds. Preview free; pay to download.

## Architecture

- **artifacts/music-mastering** — React + Vite frontend (dark theme, Framer Motion animations)
- **artifacts/api-server** — Express API server; in dev it also spawns the Vite dev server on :5174 and proxies through to :8080
- **artifacts/api-server/src/lib/audioMastering.py** — Python worker (pyloudnorm, scipy, soundfile) invoked by `masteringProcessor.ts`
- **lib/db** — Shared Drizzle ORM schema (Postgres). Tables: `users`, `mastering_jobs`, `processedPayments`
- **lib/api-client-react** — Generated OpenAPI client (orval) + `customFetch` with Clerk bearer-token support

## Pricing model

| Plan | Price | How |
|---|---|---|
| Trial | Free | 1 master per account; preview only, download locked |
| Single | $2 | One-time charge; unlocks 1 specific track + email |
| 24-hour pass | $10 | Extends `dayPassExpiresAt` by 24h (atomic SQL, stackable) |
| Lifetime | $200 | Sets `lifetime=true` on the user |

Entitlement priority: `lifetime > day-pass > credit > trial`

## Auth & Billing

- **Clerk** — authentication. JWT from Clerk is set via `setAuthTokenGetter` in `ApiAuthBridge`. The API reads it from `Authorization: Bearer` header on every request.
- **Paystack** — one-time charges (no subscriptions). Three plans: `single`, `day`, `lifetime`.
- Idempotency: `processedPayments` table with `ON CONFLICT DO NOTHING` prevents double-crediting from verify + webhook races.
- Email: Resend fires after job completion when `downloadUnlocked=true`. Atomic claim-then-send prevents duplicate sends (`emailSentAt` column, claimed with `RETURNING`).

## Key files

- `artifacts/api-server/src/routes/billing.ts` — checkout, verify, applyPurchase
- `artifacts/api-server/src/routes/webhook.ts` — Paystack HMAC webhook
- `artifacts/api-server/src/routes/mastering/index.ts` — upload, download (gated by `?download=1` + `downloadUnlocked`)
- `artifacts/api-server/src/lib/plans.ts` — `computeEntitlement`
- `artifacts/api-server/src/lib/postPurchaseEmail.ts` — atomic email claim-then-send
- `artifacts/api-server/src/lib/email.ts` — Resend wrapper
- `artifacts/music-mastering/src/pages/landing.tsx` — hero, testimonials, pricing teaser, CTA
- `artifacts/music-mastering/src/components/SupportChat.tsx` — floating FAQ chatbot
- `artifacts/music-mastering/src/pages/job.tsx` — A/B waveform, paywall card, download button

## Environment variables

See `ENV.md` for full details.

**API server:** `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, optional: `RESEND_FROM_EMAIL`, `PUBLIC_APP_URL`, `PORT`, `NODE_ENV`

**Frontend build:** `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, optional: `VITE_CLERK_PROXY_URL`

## Database schema

`users` — id (Clerk userId), email, plan, lifetime, credits, dayPassExpiresAt, freeTrialUsed, createdAt, updatedAt

`mastering_jobs` — id, userId, filename, originalFilename, preset, status, progress, downloadUnlocked, unlockMode, emailSentAt, targetLufs, measuredInputLufs, measuredOutputLufs, errorMessage, createdAt, completedAt

`processedPayments` — id, paystackReference (unique), userId, plan, createdAt — used for idempotency

To sync schema: `pnpm --filter @workspace/db run push`

## Deployment

**Frontend → Netlify:** `netlify.toml` is at repo root. Build command: `pnpm --filter @workspace/music-mastering run build`. Publish: `artifacts/music-mastering/dist/public`. Set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_PAYSTACK_PUBLIC_KEY` in Netlify env.

**API → Replit (always-on):** Keep existing api-server workflow. Set Paystack webhook to `https://<domain>/api/webhooks/paystack`.

**Split-origin deploy env vars (only if frontend is on a different domain than API):**
- Frontend: set `VITE_API_BASE_URL=https://<api-domain>` so the React client calls the right host.
- API: set `FRONTEND_ORIGINS=https://<frontend-domain>` (comma-separated for multiple) so CORS allows the frontend.

If frontend and API share the same origin (e.g. served by api-server in production), neither is needed.

## Known tradeoffs

- Free preview streams full-quality audio; a technical user could capture it from DevTools. Accepted as v1 tradeoff.
- `RESEND_FROM_EMAIL` must be a verified Resend domain. Until configured, emails only deliver to the Resend account owner's address.
- The `artifacts/music-mastering: web` workflow has `run = "sleep infinity"` because the Vite dev server is spawned by the api-server workflow instead.

## Scratchpad

- DB schema in `lib/db/src/schema/`. After changes: run `pnpm --filter @workspace/db run push` and rebuild `lib/api-client-react` with `cd lib/api-client-react && pnpm exec tsc -p .` to update dist types.
- Plan labels in DB: `'trial' | 'payg' | 'day' | 'lifetime'`. Cancel endpoint is a no-op.
- CORS: in dev allows all origins; in prod requires `FRONTEND_ORIGINS` env var.
