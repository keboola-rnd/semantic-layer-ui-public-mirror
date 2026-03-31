#!/bin/bash
set -Eeuo pipefail

cd /app

# Install all deps (including devDependencies needed for build)
npm ci --prefer-offline 2>&1 || npm install 2>&1

# Build the React app
npm run build 2>&1

# Remove devDependencies after build to save space
npm prune --production 2>&1 || true
