#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
# Install Python audio deps declared in pyproject.toml (non-blocking if already present)
pip install -r artifacts/api-server/requirements.txt --quiet || true
