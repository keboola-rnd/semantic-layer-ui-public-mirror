#!/bin/bash
set -Eeuo pipefail

cd /app

# Install all deps (devDependencies needed for vite build)
npm ci 2>&1 || npm install 2>&1

# Build the React app
npm run build 2>&1

# Don't prune — server needs @anthropic-ai/sdk and multer at runtime
