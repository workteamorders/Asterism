#!/usr/bin/env bash
# Deploys Asterism with a Foundry keystore or a Ledger. There is no flag, variable or file that takes a private key.
#
#   scripts/deploy.sh <testnet|mainnet|local|dex-testnet> (--account <keystore-name> | --ledger) [--rpc <url>] [--broadcast]
#
# dex-testnet deploys a stand-in wrapped-ether token and V2-compatible factory for a testnet rehearsal (the testnet has no
# official Uniswap V2). Those contracts are test mocks, not Uniswap's, and the script refuses to run on mainnet.
#
# Without --broadcast this only simulates (nothing is sent) and prints what would be deployed.
# With --broadcast, forge asks for the keystore password (or the Ledger asks you to confirm on the device).
#
# Mainnet also needs, in your shell only:  export ASTERISM_MAINNET_ACK="I have an external audit, a legal review, and I understand every parameter is permanent"
# Create a keystore once with:  cast wallet import <name> --interactive      (types the key into a hidden prompt, never into history)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
usage() { sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

NET="${1:-}"; shift || true
SCRIPT=Deploy
ACCOUNT=""; LEDGER=0; RPC=""; BROADCAST=0
while [ $# -gt 0 ]; do
  case "$1" in
    --account) ACCOUNT="${2:?--account needs a keystore name}"; shift 2 ;;
    --ledger) LEDGER=1; shift ;;
    --rpc) RPC="${2:?--rpc needs a URL}"; shift 2 ;;
    --broadcast) BROADCAST=1; shift ;;
    *) echo "unknown argument: $1" >&2; usage ;;
  esac
done

case "$NET" in
  testnet) CHAIN=46630; DEFAULT_RPC="https://rpc.testnet.chain.robinhood.com" ;;
  mainnet) CHAIN=4663;  DEFAULT_RPC="https://rpc.mainnet.chain.robinhood.com" ;;
  dex-testnet) CHAIN=46630; DEFAULT_RPC="https://rpc.testnet.chain.robinhood.com"; SCRIPT=DeployTestnetDex ;;
  local)   CHAIN=31337; DEFAULT_RPC="http://127.0.0.1:8545" ;;
  *) usage ;;
esac
RPC="${RPC:-$DEFAULT_RPC}"

if [ -n "$ACCOUNT" ] && [ "$LEDGER" = 1 ]; then echo "Choose either --account or --ledger." >&2; exit 2; fi
if [ -z "$ACCOUNT" ] && [ "$LEDGER" = 0 ]; then echo "A signer is required: --account <keystore-name> or --ledger." >&2; exit 2; fi
# Refuse environments that would put a raw key in play.
for v in PRIVATE_KEY ETH_PRIVATE_KEY DEPLOYER_PRIVATE_KEY MNEMONIC ETH_KEYSTORE_PASSWORD; do
  if [ -n "${!v:-}" ]; then echo "Refusing to run: $v is set in this shell. Unset it; this script only uses a keystore or a Ledger." >&2; exit 2; fi
done

command -v forge >/dev/null || { echo "Foundry is not installed. See https://book.getfoundry.sh/getting-started/installation" >&2; exit 1; }
CFG="$ROOT/deployments/config/$CHAIN.json"
if [ "$SCRIPT" = Deploy ]; then
  [ -f "$CFG" ] || { echo "Missing $CFG. Copy deployments/config/$CHAIN.example.json and fill it in." >&2; exit 1; }
  if grep -q '"REPLACE' "$CFG"; then echo "$CFG still contains REPLACE_ placeholders." >&2; exit 1; fi
fi

LIVE="$(cast chain-id --rpc-url "$RPC")"
[ "$LIVE" = "$CHAIN" ] || { echo "RPC reports chain $LIVE, expected $CHAIN. Not continuing." >&2; exit 1; }

SIGNER=(); if [ -n "$ACCOUNT" ]; then SIGNER=(--account "$ACCOUNT"); else SIGNER=(--ledger); fi
MODE=(); if [ "$BROADCAST" = 1 ]; then MODE=(--broadcast); fi

echo "Network $NET (chain $CHAIN), RPC $RPC"
if [ "$BROADCAST" = 1 ]; then echo "BROADCASTING. Parameters in $CFG become permanent."; else echo "Simulation only. Add --broadcast to send."; fi

cd "$ROOT/contracts"
forge script "script/$SCRIPT.s.sol" --rpc-url "$RPC" "${SIGNER[@]}" "${MODE[@]}"

if [ "$BROADCAST" = 1 ] && [ "$SCRIPT" = Deploy ]; then
  cat <<NEXT

Next steps (see docs/LAUNCH-CHECKLIST.md):
  1. cd web && node scripts/record-deployment.mjs --chain $CHAIN --rpc $RPC
  2. node scripts/verify-deployment.mjs --chain $CHAIN        (must print "All checks passed")
  3. Verify source on the explorer (forge verify-contract --verifier blockscout), then build and publish the site.
NEXT
fi
