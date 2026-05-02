# Puremix.ai — AI Music Mastering SaaS

Afrobeats/hip-hop/trap-focused AI mastering SaaS. Upload an audio track, get a release-ready master in seconds. Preview free; pay to download.

## Architecture

- **artifacts/music-mastering** — React + Vite frontend (near-black + pink theme, Framer Motion animations)
- **artifacts/api-server** — Express API server; in dev also spawns the Vite dev server on :5174 and proxies through to :8080
- **artifacts/api-server/src/lib/audioMastering.py** — Python worker (pyloudnorm, scipy, soundfile, pydub) invoked by `masteringProcessor.ts`
- **lib/db** — Shared Drizzle ORM schema (Postgres). Tables: `users`, `mastering_jobs`, `processedPayments`
- **lib/api-client-react** — Generated OpenAPI client (orval) + `customFetch` with Clerk bearer-token support
- **lib/integrations-gemini-ai** — Replit AI Integrations Gemini SDK wrapper (used for Mixbot chatbot)

## Pricing model

| Plan | Price | How |
|---|---|---|
| Starter | Free (1x) | 1 master per account; preview only, download locked |
| Single | $2 | One-time charge; unlocks 1 specific track + email |
| 24-hour pass | $10 | Extends `dayPassExpiresAt` by 24h (atomic SQL, stackable) |
| Lifetime | $200 | Sets `lifetime=true` on the user |

Entitlement priority: `lifetime > day-pass > credit > trial`

UI note: plan key `trial` displays as "Starter" everywhere in the UI. All "free" copy has been removed.

## Auth & Billing

- **Clerk** — authentication. JWT from Clerk is set via `setAuthTokenGetter` in `ApiAuthBridge`. The API reads it from `Authorization: Bearer` header on every request.
- **Paystack** — one-time charges (no subscriptions). Three plans: `single`, `day`, `lifetime`.
- Idempotency: `processedPayments` table with `ON CONFLICT DO NOTHING` prevents double-crediting from verify + webhook races.
- Email: Resend fires after job completion when `downloadUnlocked=true`. Atomic claim-then-send prevents duplicate sends (`emailSentAt` column, claimed with `RETURNING`).

## Mastering Controls (Advanced Studio)

The upload page (`/studio`) exposes a collapsible "Studio Controls" panel with:

| Control | Range | Notes |
|---|---|---|
| Target LUFS | -23 to -6 LUFS | Loudness target (per-preset defaults shown) |
| Bass Enhancement | ±6 dB | Low-shelf EQ at 200 Hz |
| Brightness / Air | ±6 dB | High-shelf EQ at 10 kHz |
| Stereo Width | 50–200% | Mid-side stereo width factor |
| Compression | light / medium / heavy | Overrides preset compression |
| Warmth | toggle | Even-order harmonic saturation (arctan) |
| Punch | toggle | Transient enhancement on low-mid band |

These are stored as JSON in `mastering_jobs.customParams` and passed to the Python worker as 5th argument (`sys.argv[5]`).

## Mixbot AI Chatbot

- Powered by Gemini 2.5 Flash via Replit AI Integrations (no API key needed)
- Backend: `POST /api/chat` — no auth required, SSE streaming
- Body: `{ messages: [{role: "user"|"assistant", content: string}][] }`
- System prompt includes: all preset details, advanced control descriptions, genre-specific advice (Afrobeats, trap, R&B, etc.), pricing info
- Frontend: `SupportChat.tsx` — floating bubble, animated panel, streaming text render, quick-prompt suggestions on first open
- Located: `artifacts/api-server/src/routes/chat.ts`, `artifacts/music-mastering/src/components/SupportChat.tsx`

## Key files

- `artifacts/api-server/src/routes/billing.ts` — checkout, verify, applyPurchase
- `artifacts/api-server/src/routes/webhook.ts` — Paystack HMAC webhook
- `artifacts/api-server/src/routes/mastering/index.ts` — upload (with customParams parsing), download (gated by `?download=1` + `downloadUnlocked`)
- `artifacts/api-server/src/routes/chat.ts` — Mixbot AI chat SSE endpoint
- `artifacts/api-server/src/lib/plans.ts` — `computeEntitlement`
- `artifacts/api-server/src/lib/audioMastering.py` — Python worker with 7 effects: EQ, bass shelf, brightness shelf, compression, warmth, punch, stereo width
- `artifacts/api-server/src/lib/masteringProcessor.ts` — passes customParams as 5th arg to Python
- `artifacts/api-server/src/lib/postPurchaseEmail.ts` — atomic email claim-then-send
- `artifacts/api-server/src/lib/email.ts` — Resend wrapper
- `artifacts/music-mastering/src/pages/landing.tsx` — hero, testimonials, pricing teaser, CTA
- `artifacts/music-mastering/src/pages/upload.tsx` — studio page with advanced controls UI (Slider, Switch, collapsible)
- `artifacts/music-mastering/src/components/SupportChat.tsx` — AI-powered Mixbot floating chatbot
- `artifacts/music-mastering/src/pages/job.tsx` — A/B waveform, paywall card, download button

## Environment variables

**API server:** `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` (auto-provisioned), optional: `RESEND_FROM_EMAIL`, `PUBLIC_APP_URL`, `PORT`, `NODE_ENV`

**Frontend build:** `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, optional: `VITE_CLERK_PROXY_URL`

## Database schema

`users` — id (Clerk userId), email, plan, lifetime, credits, dayPassExpiresAt, freeTrialUsed, createdAt, updatedAt

`mastering_jobs` — id, userId, filename, originalFilename, preset, status, progress, downloadUnlocked, unlockMode, emailSentAt, targetLufs, measuredInputLufs, measuredOutputLufs, errorMessage, customParams (JSON), createdAt, completedAt

`processedPayments` — id, paystackReference (unique), userId, plan, createdAt — used for idempotency

To sync schema: `pnpm --filter @workspace/db run push`

## Build notes

- `artifacts/api-server/build.mjs` — esbuild bundler. `@google/genai` must NOT be in the externals list (it gets bundled). `@google-cloud/*` stays external.
- Python worker is copied to `dist/audioMastering.py` during build.
- Gemini integration: `lib/integrations-gemini-ai` — install with `pnpm install --no-frozen-lockfile`

## Deployment

**Frontend → Netlify:** `netlify.toml` at repo root. Build: `pnpm --filter @workspace/music-mastering run build`. Publish: `artifacts/music-mastering/dist/public`.

**API → Replit (always-on):** Keep existing api-server workflow. Set Paystack webhook to `https://<domain>/api/billing/webhook`.

## Known tradeoffs

- Free preview streams full-quality audio; a technical user could capture it from DevTools. Accepted as v1 tradeoff.
- `RESEND_FROM_EMAIL` must be a verified Resend domain. Until configured, emails only deliver to the Resend account owner's address.
- The `artifacts/music-mastering: web` workflow has `run = "sleep infinity"` because the Vite dev server is spawned by the api-server workflow instead.
- Mixbot chatbot (`/api/chat`) has no rate limiting — add IP-based rate limiting before high-traffic launch to prevent abuse.

## Scratchpad

- DB schema in `lib/db/src/schema/`. After changes: run `pnpm --filter @workspace/db run push` and rebuild `lib/api-client-react` with `cd lib/api-client-react && pnpm exec tsc -p .` to update dist types.
- Plan labels in DB: `'trial' | 'payg' | 'day' | 'lifetime'`. Trial displays as "Starter" in UI.
- Upload route: `/studio` (not `/upload`)
- Chat route: `POST /api/chat` (no auth — open to all)
- CORS: in dev allows all origins; in prod requires `FRONTEND_ORIGINS` env var.
