# Environment Variables — Puremix.ai

This document describes every environment variable used by the project. Variables marked **required** must be set for the service to start. Variables marked **optional** fall back to safe defaults but should be set in production. Variables marked **auto** are injected by Replit and should not be set manually.

---

## API Server (`artifacts/api-server`)

### Core

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Required | PostgreSQL connection string. Provided by Replit's built-in Postgres add-on. Example: `postgresql://user:pass@host:5432/dbname` |
| `PORT` | Auto | Port the Express server binds to. Defaults to `8080`. Set automatically by Replit. |
| `NODE_ENV` | Optional | `development` or `production`. Controls logging verbosity and dev-only middleware. |

### Authentication (Clerk)

| Variable | Required | Description |
|---|---|---|
| `CLERK_SECRET_KEY` | ✅ Required | Clerk server-side secret key. Found in Clerk Dashboard → API Keys. Format: `sk_live_...` |
| `CLERK_PUBLISHABLE_KEY` | ✅ Required | Clerk publishable key. Format: `pk_live_...` |

### Payments (Paystack)

| Variable | Required | Description |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | ✅ Required | Paystack secret key for charging cards and verifying webhooks. Found in Paystack Dashboard → Settings → API Keys. |

Webhook endpoint: `POST /api/webhooks/paystack` — validates the `x-paystack-signature` header against `PAYSTACK_SECRET_KEY`. Configure this URL in [Paystack Dashboard → Settings → Webhooks](https://dashboard.paystack.com/#/settings/developer).

### Email (Resend)

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | ✅ Required | Resend API key for transactional emails. Found in Resend Dashboard → API Keys. |
| `RESEND_FROM_EMAIL` | Optional | The `From` address used on all sent emails. Must be a verified Resend domain/address. Defaults to `onboarding@resend.dev` (Replit sandbox address — only delivers to your own email). **Set this in production.** Example: `noreply@puremix.ai` |
| `PUBLIC_APP_URL` | Optional | Full public URL of the deployed app. Used inside email templates for "Download master" links. Defaults to `https://puremix.ai`. Example: `https://puremix.ai` |

### AI Integrations (Replit-managed proxy — NEW)

These power the prompt-mix chat and the lyrics transcriber. They are injected automatically by the Replit AI Integrations system — **do NOT set them manually**. If they are missing, the chat/lyrics endpoints respond with `503 service unavailable` instead of crashing.

| Variable | Required | Description |
|---|---|---|
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Auto | Replit proxy URL for Anthropic. Used by `POST /api/mastering/chat` (model: `claude-haiku-4-5`). |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Auto | Bearer token for the Anthropic proxy. |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Auto | Replit proxy URL for OpenAI. Used by `POST /api/mastering/jobs/:id/lyrics` (model: `gpt-4o-mini-transcribe`). |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Auto | Bearer token for the OpenAI proxy. |

To enable these integrations on a fresh Replit, open the Integrations panel and add the **Anthropic** and **OpenAI** Replit-managed integrations. No keys are required from you.

---

## Frontend (`artifacts/music-mastering`)

| Variable | Required | Description |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ Required | Clerk publishable key, exposed to the browser. Same value as `CLERK_PUBLISHABLE_KEY` on the server. |
| `VITE_PAYSTACK_PUBLIC_KEY` | ✅ Required | Paystack public key for the browser-side Paystack.js popup. Format: `pk_live_...` |
| `VITE_CLERK_PROXY_URL` | Optional | Full proxy URL for Clerk's frontend API (used when serving Clerk through your own domain). Leave blank in development. |
| `BASE_PATH` | Build-time | URL base path Vite uses for asset resolution. Set to `/` for root deployments. Configured automatically by the artifact system in Replit. |
| `PORT` | Auto | Vite dev server port. Set automatically per artifact. |

---

## Rate limits (hard-coded, not configurable via env)

| Endpoint | Window | Limit |
|---|---|---|
| `POST /api/mastering/chat` | 1 minute | 20 messages per user |
| `POST /api/mastering/jobs/:id/lyrics` | 1 minute | 6 transcripts per user |
| All other authenticated routes | 1 minute | 60 requests per user |

If you need to tune these, see `artifacts/api-server/src/middlewares/rateLimit.ts`.

---

## Setting up for production (Netlify + separate API host)

1. **Deploy the API server** to Replit Deployments, Railway, Render, Fly.io, or similar. Set all the API Server variables above (except the `AI_INTEGRATIONS_*` ones, which only exist on Replit).
2. **In Netlify** (or your frontend host), set:
   - `VITE_CLERK_PUBLISHABLE_KEY` → your Clerk publishable key
   - `VITE_PAYSTACK_PUBLIC_KEY` → your Paystack public key
   - `NODE_VERSION=20`, `PNPM_VERSION=9`
3. Ensure the API server CORS policy allows requests from your Netlify domain.

If you deploy the API to anything other than Replit, the prompt-mix chat and lyrics transcriber will fall back to `503` — you'll need to swap the SDK init in `chat.ts` / `lyrics.ts` to use direct Anthropic / OpenAI keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) instead of the Replit proxy variables.

---

## Resend domain verification

1. Go to [Resend Dashboard → Domains](https://resend.com/domains) and add `puremix.ai` (or your subdomain).
2. Add the DNS records Resend provides to your domain registrar.
3. Once verified, set `RESEND_FROM_EMAIL=noreply@puremix.ai` on your API server.

Until the domain is verified, emails only deliver to the email address registered in your Resend account.
