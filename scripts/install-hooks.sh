#!/usr/bin/env bash
# Point git at the repository's own hooks. Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
chmod +x .githooks/*
echo "hooks installed: core.hooksPath = .githooks"
