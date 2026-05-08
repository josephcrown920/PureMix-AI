# Environment Variables — Puremix.ai

This document describes every environment variable used by the project. Variables marked **required** must be set for the service to start. Variables marked **optional** fall back to safe defaults but should be set in production.

---

## API Server (`artifacts/api-server`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Required | PostgreSQL connection string. Provided by Replit's built-in Postgres add-on. Example: `postgresql://user:pass@host:5432/dbname` |
| `CLERK_SECRET_KEY` | ✅ Required | Clerk server-side secret key. Found in Clerk Dashboard → API Keys. Format: `sk_live_...` |
| `CLERK_PUBLISHABLE_KEY` | ✅ Required | Clerk publishable key. Format: `pk_live_...` |
| `PAYSTACK_SECRET_KEY` | ✅ Required | Paystack secret key for charging cards and verifying webhooks. Found in Paystack Dashboard → Settings → API Keys. |
| `RESEND_API_KEY` | ✅ Required | Resend API key for transactional emails. Found in Resend Dashboard → API Keys. |
| `RESEND_FROM_EMAIL` | Optional | The `From` address used on all sent emails. Must be a verified Resend domain/address. Defaults to `onboarding@resend.dev` (Replit sandbox address — only delivers to your own email). **Set this in production.** Example: `noreply@puremix.ai` |
| `PUBLIC_APP_URL` | Optional | Full public URL of the deployed app. Used inside email templates for "Download master" links. Defaults to `https://puremix.ai`. Example: `https://puremix.ai` |
| `PORT` | Optional | Port the Express server binds to. Defaults to `8080`. Set automatically by Replit. |
| `NODE_ENV` | Optional | `development` or `production`. Controls logging verbosity and dev-only middleware. |

---

## Frontend (`artifacts/music-mastering`)

| Variable | Required | Description |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ Required | Clerk publishable key, exposed to the browser. Same value as `CLERK_PUBLISHABLE_KEY` on the server. |
| `VITE_PAYSTACK_PUBLIC_KEY` | ✅ Required | Paystack public key for the browser-side Paystack.js popup. Format: `pk_live_...` |
| `VITE_CLERK_PROXY_URL` | Optional | Full proxy URL for Clerk's frontend API (used when serving Clerk through your own domain). Leave blank in development. |
| `BASE_PATH` | Build-time | URL base path Vite uses for asset resolution. Set to `/` for root deployments. Configured automatically by the artifact system in Replit. |
| `PORT` | Dev only | Vite dev server port. Set automatically per artifact. |

---

## Setting up for production (Netlify + separate API host)

1. **Deploy the API server** to Railway, Render, Fly.io, or similar. Set all the API Server variables above in that host's dashboard.
2. **In Netlify**, set:
   - `VITE_CLERK_PUBLISHABLE_KEY` → your Clerk publishable key
   - `VITE_PAYSTACK_PUBLIC_KEY` → your Paystack public key
   - `NODE_VERSION=20`, `PNPM_VERSION=9`
3. Ensure the API server CORS policy allows requests from your Netlify domain.

---

## Paystack webhook setup

In [Paystack Dashboard → Settings → Webhooks](https://dashboard.paystack.com/#/settings/developer), add:

```
https://your-api-domain.com/api/webhooks/paystack
```

The webhook endpoint validates the `x-paystack-signature` header with your `PAYSTACK_SECRET_KEY`.

---

## Resend domain verification

1. Go to [Resend Dashboard → Domains](https://resend.com/domains) and add `puremix.ai` (or your subdomain).
2. Add the DNS records Resend provides to your domain registrar.
3. Once verified, set `RESEND_FROM_EMAIL=noreply@puremix.ai` on your API server.

Until the domain is verified, emails only deliver to the email address registered in your Resend account.
