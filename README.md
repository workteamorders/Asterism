# Asterism

A hybrid token/NFT collection (DN404, 2,222 maximum) on Robinhood Chain whose art is drawn entirely on-chain, with a fair-launch sale and a static website. Digital collectible; not financial advice; not affiliated with Robinhood.

```
contracts/     Foundry project: renderer, token, launcher, tests, deploy scripts
web/           Next.js static site + server functions for /api/rpc and /api/geo (Cloudflare Pages Functions in functions/, Vercel Functions in api/, sharing functions/_lib)
deployments/   Per-chain addresses (4663.json, 46630.json) and deploy config examples
scripts/       Owner scripts: gen-commit.mjs, deploy.sh
.github/       CI (free tier): contracts, lint, types, tests, build, copy and secrets checks
docs/          DECISIONS.md, CONCEPTS.md, AUDIT-PACKET.md, LAUNCH-CHECKLIST.md
```

## Check everything locally

```
cd contracts && ./install-deps.sh && forge build && forge test        # 70 tests
cd web && pnpm install && pnpm lint && pnpm test                      # lint, renderer equality, contrast, functions
pnpm copy:check && pnpm secrets:check                                  # banned copy, secrets
pnpm build                                                             # static site into out/
```

End to end (local anvil + the real Pages Functions through wrangler; never a public network): install Playwright once (`pnpm add -D playwright && npx playwright install chromium`), then `pnpm e2e:setup && pnpm e2e` from `web/` (needs Foundry on PATH, or `FOUNDRY_BIN=/path/to/bin`).

## Deploying

Never with a private key in an environment variable. See `docs/LAUNCH-CHECKLIST.md`; the scripts only accept a Foundry keystore or a Ledger.
