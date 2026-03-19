#!/bin/sh
set -e

# echo "==> Copying WASM artifacts into src/rust/"
# mkdir -p /app/src/rust
# cp /wasm-input/* /app/src/rust/ 2>/dev/null || echo "WARN: No WASM files found..."

echo "==> Building frontend..."
pnpm run build

echo "==> Copying dist to /output"
cp -r /app/dist/* /output/

echo "==> Frontend build complete"