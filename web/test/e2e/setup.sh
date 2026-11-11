#!/usr/bin/env bash
# Fresh local chain for end-to-end tests: anvil (default test accounts only), LocalDemo deployment,
# deployments/31337.json, verify:deployment, then the e2e build. Nothing here touches a public network.
set -euo pipefail
# Optional: FOUNDRY_BIN=/path/to/foundry/bin when forge, cast and anvil are not on PATH.
if [ -n "${FOUNDRY_BIN:-}" ]; then export PATH="$FOUNDRY_BIN:$PATH"; fi
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
pkill -f "anvil --port 8545" 2>/dev/null || true
sleep 1
anvil --port 8545 --accounts 20 --balance 1000 --silent > /dev/null 2>&1 &
for _ in $(seq 1 30); do cast chain-id --rpc-url http://127.0.0.1:8545 > /dev/null 2>&1 && break; sleep 0.5; done
cd "$ROOT/contracts"
LOCAL_START_DELAY=900 forge script script/LocalDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --unlocked \
  --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 > /dev/null
cd "$ROOT/web"
node scripts/record-deployment.mjs --chain 31337 --rpc http://127.0.0.1:8545 --script LocalDemo.s.sol
node scripts/verify-deployment.mjs --chain 31337 --rpc http://127.0.0.1:8545 | tail -2
bash scripts/e2e-build.sh > /dev/null
echo "local chain and e2e build ready"
