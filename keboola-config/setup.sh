#!/bin/bash
set -Eeuo pipefail
cd /app && npm install && npm run build
