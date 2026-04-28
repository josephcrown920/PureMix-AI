# Puremix.ai

**AI music mastering tuned for Afrobeats, hip-hop & trap.**

Upload a mix, get a release-ready master in under 30 seconds. Preview free — pay only when you download.

---

## What it does

- **1 free trial master** per signup — full-quality preview, download gated behind payment
- **$2** to unlock a single track + email delivery
- **$10** 24-hour unlimited pass — all tracks, all downloads for 24 hours
- **$200** lifetime plan — unlimited forever
- **4 mastering presets**: Streaming (-14 LUFS), Club, Warm Vinyl, Broadcast
- **A/B waveform comparison** — hear original vs. mastered side by side
- **Paystack payments** (cards, bank transfer, USSD) for African markets
- **Resend transactional email** — master delivered to your inbox after payment

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, Tailwind CSS v4, Framer Motion, shadcn/ui |
| Auth | Clerk |
| API server | Express + TypeScript (Node 20) |
| Python worker | `pyloudnorm`, `scipy`, `soundfile` for audio processing |
| Database | PostgreSQL via Drizzle ORM |
| Payments | Paystack |
| Email | Resend |
| Monorepo | pnpm workspaces |

---

## Project structure

```
.
├── artifacts/
│   ├── music-mastering/    # React + Vite frontend
│   └── api-server/         # Express API + Python mastering worker
├── lib/
│   ├── db/                 # Drizzle schema & migrations
│   └── api-client-react/   # Generated OpenAPI client (orval)
└── netlify.toml            # Netlify deploy config (frontend only)
```

---

## Local development

### Prerequisites

- Node 20
- pnpm 9
- Python 3.11+ with `pip`
- PostgreSQL

### Setup

```bash
# Install JS dependencies
pnpm install

# Install Python worker dependencies
pip install -r artifacts/api-server/requirements.txt

# Set environment variables
cp .env.example .env      # fill in DATABASE_URL, CLERK_*, PAYSTACK_*, RESEND_*

# Push database schema
pnpm --filter @workspace/db run push

# Start everything
pnpm --filter @workspace/api-server run dev   # API + Vite on :8080
```

Open `http://localhost:8080` in your browser.

---

## Environment variables

See [`ENV.md`](./ENV.md) for a full description of every variable.

**Quick reference:**

| Variable | Where |
|---|---|
| `DATABASE_URL` | API server |
| `CLERK_SECRET_KEY` | API server |
| `CLERK_PUBLISHABLE_KEY` | API server |
| `PAYSTACK_SECRET_KEY` | API server |
| `RESEND_API_KEY` | API server |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend build |
| `VITE_PAYSTACK_PUBLIC_KEY` | Frontend build |

---

## Deploying to production

### Frontend → Netlify

1. Connect your repo in [Netlify](https://app.netlify.com)
2. Build command: `pnpm --filter @workspace/music-mastering run build`
3. Publish directory: `artifacts/music-mastering/dist/public`
4. Set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_PAYSTACK_PUBLIC_KEY` in Netlify environment variables
5. The `netlify.toml` handles all redirects and security headers automatically

### API server → Railway / Render / Fly.io

The API server is a standard Node.js/Express app. Deploy it like any other Node server and set the environment variables listed in `ENV.md`.

### Paystack webhook

Register `https://your-api-domain.com/api/billing/webhook` in the Paystack Dashboard.

---

## Payments & billing logic

- `plans.ts` → defines pricing and entitlement computation (`lifetime > day-pass > credit > trial`)
- `billing.ts` → handles checkout, verify, and `applyPurchase` with idempotency via the `processedPayments` table
- `webhook.ts` → Paystack webhook handler (double-credit prevention via `ON CONFLICT DO NOTHING`)
- `postPurchaseEmail.ts` → atomic claim-then-send pattern (no duplicate emails)

---

## Known tradeoffs

- **Free preview streams full-quality audio.** A determined user could extract the file from browser DevTools. The next step is a degraded-quality preview stream; this was explicitly accepted as a v1 tradeoff.
- **Email delivery requires a verified Resend domain.** Until `RESEND_FROM_EMAIL` points to a verified domain, emails only go to the Resend account owner's email.

---

## License

Private — all rights reserved.
