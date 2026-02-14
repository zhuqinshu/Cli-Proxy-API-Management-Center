#!/usr/bin/env bash
set -euo pipefail

# ─── paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_STATIC_DIR="$SCRIPT_DIR/../CLIProxyAPI/static"
OUTPUT_FILE="$API_STATIC_DIR/management.html"

# ─── build frontend ─────────────────────────────────────────────────────────
echo "==> Building frontend..."
cd "$SCRIPT_DIR"
npm run build

# ─── copy to API static dir ─────────────────────────────────────────────────
mkdir -p "$API_STATIC_DIR"
cp "$SCRIPT_DIR/dist/index.html" "$OUTPUT_FILE"

echo "==> Done: $OUTPUT_FILE"
