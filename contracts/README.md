# Asterism contracts

Solidity 0.8.28, Foundry. `./install-deps.sh` clones the pinned dependencies (dn404, solady, forge-std) and verifies their commits.

- `src/AsterismRenderer.sol` pure on-chain SVG and metadata
- `src/AsterismToken.sol` DN404 token (launcher-only mint/burn, transfer lock until finalization, names)
- `src/AsterismLauncher.sol` fixed-price sale, permissionless finalization into Uniswap V2 at price parity, pull-only treasury, refunds, commit-reveal seed with fallback
- `src/LiquiditySink.sol` empty contract that holds the LP tokens

`forge test` runs unit, fuzz and invariant tests (70 in total). The Solidity renderer is compared byte for byte with the TypeScript reference for all 2,222 ids using fixtures in `test/fixtures/` (regenerate with `pnpm fixtures` in `web/`).

Deploy with `../scripts/deploy.sh` (keystore or Ledger only). See `../docs/AUDIT-PACKET.md`.
