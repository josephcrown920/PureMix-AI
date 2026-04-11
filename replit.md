# Workspace

## Overview

pnpm workspace monorepo using TypeScript. MasterAI - a full-stack AI music mastering web application.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS (dark amber theme)
- **Python audio processing**: pydub, pyloudnorm, scipy, soundfile, ffmpeg

## Architecture

All web traffic goes through the API server on port 8080:
- `/api/*` → Express API routes
- `/*` → Proxy to Vite dev server (port 5174) in development, or static files in production

The API server spawns the Vite dev server as a child process in development mode. This is needed because Replit's port monitoring only detects port 8080 (from `.replit` port mappings).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server (also starts Vite dev server)

## Packages

- `artifacts/api-server` — Express API server (port 8080), serves frontend proxy and API routes
- `artifacts/music-mastering` — React + Vite frontend (port 5174 in dev, built to static in prod)
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`)
- `lib/api-zod` — Zod schemas generated from OpenAPI spec
- `lib/api-client` — Axios HTTP client generated from OpenAPI spec
- `lib/api-client-react` — React Query hooks generated from OpenAPI spec
- `lib/db` — Drizzle ORM schema and database client

## Audio Mastering Pipeline

1. User uploads audio file (MP3/WAV/FLAC) via multipart form
2. File stored in `uploads/input/`
3. Python script (`audioMastering.py`) runs: LUFS analysis → EQ → compression → stereo enhancement → limiting
4. Output stored in `uploads/output/`
5. Job status tracked in PostgreSQL via `masteringJobs` table

## Presets

- Streaming Ready: -14 LUFS (Spotify, Apple Music)
- Club / Loud: -7 LUFS (maximum loudness)
- Warm Vinyl: -12 LUFS (analog warmth)
- Broadcast: -23 LUFS (EBU R128 standard)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
