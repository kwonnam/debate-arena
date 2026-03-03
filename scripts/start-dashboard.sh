#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "==> DEBATE ARENA dashboard bootstrap"

if [[ ! -d node_modules ]]; then
  echo "==> Installing dependencies..."
  npm install
else
  echo "==> Dependencies already installed (node_modules exists)"
fi

echo "==> Building project..."
npm run build

echo "==> Starting dashboard server at http://localhost:3847"
echo "    (Press Ctrl+C to stop)"

exec node dist/src/server/index.js
