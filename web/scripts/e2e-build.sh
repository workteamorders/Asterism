#!/usr/bin/env bash
# Builds the site against local anvil (chain 31337) with the mock wallet connector, into out-e2e/.
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_PUBLIC_CHAIN_ID=31337
export NEXT_PUBLIC_E2E=1
export NEXT_PUBLIC_E2E_ACCOUNT="${E2E_ACCOUNT:-0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC}"
export NEXT_PUBLIC_SITE_URL=http://127.0.0.1:8788
export CSP_EXTRA_CONNECT=http://127.0.0.1:8545
node scripts/prepare.mjs
npx next build
node scripts/postbuild.mjs
rm -rf out-e2e && cp -r out out-e2e
echo "e2e build in out-e2e/"
