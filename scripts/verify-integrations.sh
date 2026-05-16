#!/usr/bin/env bash
# Puremix.ai — Integration Verification Script
# Run this after all secrets are set to confirm every service is wired up.
# Usage: bash scripts/verify-integrations.sh
# All failures are collected and reported at the end — the script never exits early.
set -uo pipefail

PASS=0
FAIL=0

ok()   { echo "[PASS] $1"; PASS=$((PASS+1)); }
fail() { echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== Puremix.ai Integration Verification ==="
echo ""

# ── 1. Environment secrets ──────────────────────────────────────────────────
echo "-- Secrets --"
[ -n "${CLERK_SECRET_KEY:-}"       ] && ok "CLERK_SECRET_KEY set"      || fail "CLERK_SECRET_KEY missing"
[ -n "${PAYSTACK_SECRET_KEY:-}"    ] && ok "PAYSTACK_SECRET_KEY set"   || fail "PAYSTACK_SECRET_KEY missing"
[ -n "${RESEND_API_KEY:-}"         ] && ok "RESEND_API_KEY set"        || fail "RESEND_API_KEY missing"
[ -n "${DATABASE_URL:-}"           ] && ok "DATABASE_URL set"          || fail "DATABASE_URL missing"
[ -n "${AI_INTEGRATIONS_ANTHROPIC_BASE_URL:-}" ] && ok "AI_INTEGRATIONS_ANTHROPIC_BASE_URL set" || fail "ANTHROPIC base URL missing"
[ -n "${AI_INTEGRATIONS_OPENAI_BASE_URL:-}"    ] && ok "AI_INTEGRATIONS_OPENAI_BASE_URL set"    || fail "OPENAI base URL missing"

echo ""

# ── 2. Database tables ──────────────────────────────────────────────────────
echo "-- Database --"
TABLES=$(psql "$DATABASE_URL" -t -c "\dt" 2>/dev/null | grep -c "table" || echo "0")
if [ "$TABLES" -ge 3 ]; then
  ok "DB tables present (users, mastering_jobs, processed_payments)"
else
  fail "DB tables missing or DB unreachable"
fi

echo ""

# ── 3. API server health ────────────────────────────────────────────────────
echo "-- API Server --"
HEALTH=$(curl -s --max-time 5 http://localhost:8080/api/healthz 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"ok"'; then
  ok "API /api/healthz → {status:ok}"
else
  fail "API health check failed: $HEALTH"
fi

PLANS=$(curl -s --max-time 5 http://localhost:8080/api/billing/plans 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['plans']))" 2>/dev/null || echo "0")
if [ "$PLANS" -ge 3 ]; then
  ok "Billing plans API returns $PLANS plans"
else
  fail "Billing plans API failed (got $PLANS plans)"
fi

AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8080/api/me 2>/dev/null || echo "0")
if [ "$AUTH_STATUS" = "401" ]; then
  ok "Clerk auth middleware enforcing (401 on /api/me without token)"
else
  fail "Clerk middleware unexpected status on /api/me: $AUTH_STATUS (expected 401)"
fi

echo ""

# ── 4. Paystack ─────────────────────────────────────────────────────────────
echo "-- Paystack --"
PAYSTACK_STATUS=$(curl -s --max-time 10 \
  -H "Authorization: Bearer $PAYSTACK_SECRET_KEY" \
  "https://api.paystack.co/transaction?perPage=1" 2>/dev/null \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "false")
if [ "$PAYSTACK_STATUS" = "True" ]; then
  ok "Paystack live key verified (transactions endpoint reachable)"
else
  fail "Paystack key verification failed"
fi

echo ""

# ── 5. Resend ───────────────────────────────────────────────────────────────
echo "-- Resend --"
RESEND_ID=$(curl -s --max-time 10 -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"Puremix.ai <onboarding@resend.dev>","to":["delivered@resend.dev"],"subject":"Integration check","html":"<p>OK</p>"}' 2>/dev/null \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
if [ -n "$RESEND_ID" ]; then
  ok "Resend email sent (id=$RESEND_ID)"
else
  fail "Resend email delivery failed"
fi

echo ""

# ── 6. Anthropic AI ─────────────────────────────────────────────────────────
echo "-- Anthropic AI (via Replit proxy) --"
ANTHROPIC_BASE="${AI_INTEGRATIONS_ANTHROPIC_BASE_URL:-}"
ANTHROPIC_KEY="${AI_INTEGRATIONS_ANTHROPIC_API_KEY:-}"
CLAUDE_MODEL="${ANTHROPIC_MODEL:-claude-haiku-4-5}"
if [ -z "$ANTHROPIC_BASE" ] || [ -z "$ANTHROPIC_KEY" ]; then
  fail "Anthropic env vars not set (AI_INTEGRATIONS_ANTHROPIC_BASE_URL / API_KEY)"
else
  CLAUDE=$(curl -s --max-time 15 -X POST "$ANTHROPIC_BASE/v1/messages" \
    -H "Authorization: Bearer $ANTHROPIC_KEY" \
    -H "Content-Type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d "{\"model\":\"$CLAUDE_MODEL\",\"max_tokens\":10,\"messages\":[{\"role\":\"user\",\"content\":\"Reply: OK\"}]}" 2>/dev/null \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['content'][0]['text'][:10])" 2>/dev/null || echo "")
  if [ -n "$CLAUDE" ]; then
    ok "Anthropic $CLAUDE_MODEL reachable: $CLAUDE"
  else
    fail "Anthropic AI integration failed (model=$CLAUDE_MODEL)"
  fi
fi

echo ""

# ── 7. OpenAI Whisper ───────────────────────────────────────────────────────
echo "-- OpenAI Whisper (via Replit proxy) --"
OPENAI_BASE="${AI_INTEGRATIONS_OPENAI_BASE_URL:-}"
OPENAI_KEY="${AI_INTEGRATIONS_OPENAI_API_KEY:-}"
WHISPER_MODEL="${OPENAI_WHISPER_MODEL:-gpt-4o-mini-transcribe}"
if [ -z "$OPENAI_BASE" ] || [ -z "$OPENAI_KEY" ]; then
  fail "OpenAI env vars not set (AI_INTEGRATIONS_OPENAI_BASE_URL / API_KEY)"
else
  python3 -c "
import numpy as np, soundfile as sf
sr=44100; t=np.linspace(0,1,sr); d=(0.1*np.sin(2*np.pi*440*t)); d=np.stack([d,d],axis=1).astype('float32')
sf.write('/tmp/_whisper_test.wav', d, sr)
" 2>/dev/null || true
  WHISPER=$(curl -s --max-time 20 -X POST "$OPENAI_BASE/audio/transcriptions" \
    -H "Authorization: Bearer $OPENAI_KEY" \
    -F "file=@/tmp/_whisper_test.wav" \
    -F "model=$WHISPER_MODEL" \
    -F "response_format=json" 2>/dev/null \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('ok' if 'text' in d else 'fail')" 2>/dev/null || echo "fail")
  if [ "$WHISPER" = "ok" ]; then
    ok "OpenAI Whisper ($WHISPER_MODEL) reachable"
  else
    fail "OpenAI Whisper integration failed (model=$WHISPER_MODEL)"
  fi
fi

echo ""

# ── 8. Python mastering engine ──────────────────────────────────────────────
echo "-- Python Mastering Engine --"
python3 -c "
import numpy as np, soundfile as sf
sr=44100; t=np.linspace(0,2,sr*2); d=(0.1*np.sin(2*np.pi*440*t)); d=np.stack([d,d],axis=1).astype('float32')
sf.write('/tmp/_mastering_test_in.wav', d, sr)
"
MASTERING=$(python3 artifacts/api-server/src/lib/audioMastering.py \
  /tmp/_mastering_test_in.wav /tmp/_mastering_test_out.wav streaming -14 2>/dev/null \
  | python3 -c "
import sys,json
for line in sys.stdin:
    try:
        d=json.loads(line)
        if d['type']=='result': print(f'in={d[\"input_lufs\"]:.1f} out={d[\"output_lufs\"]:.1f}')
    except: pass
" 2>/dev/null || echo "")
if [ -n "$MASTERING" ]; then
  ok "Mastering engine OK: $MASTERING"
else
  fail "Python mastering engine failed"
fi

echo ""

# ── 9. Python audio deps ────────────────────────────────────────────────────
echo "-- Python Audio Dependencies --"
python3 -c "import pedalboard; print('pedalboard', pedalboard.__version__)" 2>/dev/null && ok "pedalboard installed" || fail "pedalboard missing"
python3 -c "import pyloudnorm" 2>/dev/null && ok "pyloudnorm installed" || fail "pyloudnorm missing"
python3 -c "import soundfile" 2>/dev/null && ok "soundfile installed" || fail "soundfile missing"
python3 -c "import pydub" 2>/dev/null && ok "pydub installed" || fail "pydub missing"

echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
