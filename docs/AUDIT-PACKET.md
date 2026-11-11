# Asterism: audit packet

For an external auditor. Everything here describes the code in `contracts/` as it stands in this repository. Nothing here is a claim that the code is safe: **no external audit has been done**. Slither 0.11.6 was run (section 9b) and Forge's own linter runs on every build with the exclusions listed below. Aderyn was not run.

## 1. What the system does

A fixed-supply hybrid token (ERC-20 plus ERC-721 through DN404), 2,222 maximum, with on-chain SVG art. One whole token (1e18 units) carries one NFT. A single `AsterismLauncher` sells 60% of supply at a fixed price, then anyone can finalize: the contract opens a Uniswap V2 pair at exactly the sale price, sends the LP tokens to a contract with no functions, and the remaining ETH is payable only to a treasury address fixed at deployment. If nobody finalizes within the window, every buyer can take a full refund. The art seed comes from a commit-reveal secret mixed with entropy from the purchases, with a permissionless fallback.

## 2. Scope

| File | Role |
| --- | --- |
| `src/AsterismLauncher.sol` | Sale, finalization, treasury pull, refunds, reveal. Deploys the token (which deploys its mirror) and the sink. |
| `src/AsterismToken.sol` | DN404 token: launcher-only mint/burn, transfer lock before finalization, names. |
| `src/AsterismRenderer.sol` | Pure on-chain SVG and metadata, tier assignment. |
| `src/LiquiditySink.sol` | Empty contract. Holds the LP tokens. |
| `src/interfaces/IUniswapV2.sol` | Minimal factory, pair and WETH interfaces. |
| `script/Deploy.s.sol`, `script/AsterismConfig.sol` | Deployment (owner runs manually with a keystore or Ledger). `LocalDemo.s.sol` is anvil only. |

Out of scope: `lib/` (third-party, pinned below), `test/`, the website.

Third-party code, pinned by commit in `contracts/install-deps.sh` (the script fails if the checked-out commit differs):

| Dependency | Version | Commit |
| --- | --- | --- |
| Vectorized/dn404 | v0.0.25 | `3397cb11558ac853912ee87871422b6a29c9d346` (contains the Guardian fix `3bd0698`) |
| Vectorized/solady | v0.1.26 | `acd959aa4bd04720d640bf4e6a5c71037510cc4b` |
| foundry-rs/forge-std | v1.16.2 | `bf647bd6046f2f7da30d0c2bf435e5c76a780c1b` (tests and scripts only) |

Build: solc 0.8.28 (the default Foundry profile downloads it once; the isolated build container used `FOUNDRY_PROFILE=container` with a local binary and no network), EVM `cancun`, optimizer 200 runs, `bytecode_hash = none`, `cbor_metadata = false`, `deny_warnings`. Runtime sizes: Launcher 9,427 B, Renderer 12,107 B, Token 12,309 B (limit on the chain: 98,304 B).

## 3. Roles and privileges

| Role | Who | Can |
| --- | --- | --- |
| Launcher | `AsterismLauncher`, fixed in the token at deployment | Mint sale tokens and pool tokens (capped at `maxSupply`), burn on refund, mark pool/sink/launcher as skipNFT, open trading once. |
| Revealer | The deployer of the launcher (`msg.sender` in its constructor) | Call `reveal(secret)` once, after finalization and before the deadline. Nothing else. |
| Treasury | Address fixed at deployment | Receives ETH when anyone calls `withdrawTreasury()`. Has no special call. |
| Everyone else | | `buy`, `finalizeLaunch`, `withdrawTreasury`, `refund`, `revealFallback`, token transfers (after trading opens), `setName` on NFTs they own. |

There is no owner, admin, pause, upgrade, fee, tax or blacklist. The mirror's `owner()` returns the zero address (DN404 would otherwise allow `pullOwner`).

## 4. External functions and allowed callers

**AsterismLauncher**

| Function | Caller | Conditions |
| --- | --- | --- |
| `buy(uint256 amount)` payable | anyone | Sale window open, not finalized, `0 < amount <= txCap`, wallet cap, `sold + amount <= saleCap`, `msg.value >= amount * mintPrice` (excess returned). |
| `finalizeLaunch()` | anyone | Not finalized, `sold > 0`, (`sold == saleCap` or after `saleEnd`), and not after `saleEnd + finalizeWindow`. At least one liquidity token. |
| `withdrawTreasury()` | anyone | Sends the whole pending treasury balance to the immutable treasury. Pull only. |
| `refund()` | a buyer | After `saleEnd + finalizeWindow`, not finalized. Burns the caller's purchased tokens, returns exactly what the caller paid. |
| `reveal(bytes32 secret)` | revealer | Finalized, not yet revealed, not after `finalizedAt + revealWindow`, `keccak256(secret) == revealCommit`. Sets `seed = keccak256(secret, entropy)`. |
| `revealFallback()` | anyone | Finalized, not revealed, strictly after the deadline. Sets `seed = keccak256(entropy, revealCommit)`. |
| views | anyone | `status()`, `state()`, `remainingFor(address)`, `liquiditySplit()`, `revealDeadline()`, immutables. |

**AsterismToken** (ABI-exact list)

| Function | Caller |
| --- | --- |
| `mintSale`, `mintToPool`, `burnForRefund`, `markSkipNFT`, `openTrading` | launcher only (`NotLauncher` otherwise) |
| `setName(uint256,string)` | owner of that NFT; name validated by the renderer |
| `transfer`, `transferFrom`, `approve`, `setSkipNFT(bool)` | anyone (transfers revert with `TradingClosed` until trading opens, except from the launcher) |
| views | `allowance`, `balanceOf`, `decimals`, `exists`, `getSkipNFT`, `launcher`, `maxSupply`, `mirrorERC721`, `name`, `nameOf`, `namedBy`, `nftBalanceOf`, `ownedIds`, `ownerAt`, `renderer`, `symbol`, `totalNFTSupply`, `totalSupply`, `tradingOpen` |

**DN404Mirror** (deployed unmodified by the token's constructor): ERC-721 surface (`approve`, `safeTransferFrom` x2, `transferFrom`, `setApprovalForAll`, `ownerOf`, `tokenURI`, ...). `pullOwner` exists but there is no owner to pull; `owner()` returns zero.

**AsterismRenderer**: all functions are `view` or `pure`. No state, no constructor input after deployment.

**LiquiditySink**: no functions. Runtime size 8 bytes. It cannot call anything, so LP tokens sent to it are permanently locked. Pair `skim` and `sync` remain callable by anyone on the pair itself, as in any Uniswap V2 pool.

## 5. Invariants (tested)

Stateful invariant tests (`test/Invariant.t.sol`, 64 runs, depth 64, random actors, time warps, trades) plus unit and fuzz tests (512 runs, fixed seed):

1. Total supply never exceeds `maxSupply`.
2. NFT count equals the sum of whole-token balances of addresses that receive NFTs.
3. ETH accounting: before finalization the launcher holds `raised - refundedTotal`; after finalization `ethLP + treasuryAmount == raised` and the launcher holds `treasuryAmount - treasuryWithdrawn`.
4. No refund is ever possible after finalization; refunds return exactly what was paid and burn the tokens.
5. Token transfers are impossible before finalization, other than from the launcher.
6. The seed never changes once set; no on-chain randomness (`block.prevrandao`, `blockhash`, etc.) is read.
7. The pool opens at exactly `mintPrice` (price parity fuzzed over sale sizes) and the LP tokens stay in the sink.
8. After finalization the status is `Trading` forever.
9. Tier counts are exact for any seed (`testFuzz_tierCountsExactForAnySeed`), and the Solidity renderer's SVG is byte-identical to the TypeScript reference for all 2,222 ids (`test_everyIdMatchesReferenceHashAndTier`, golden fixtures generated by `web/test/fixtures.gen.test.ts`).

## 6. Test results

`forge test` on foundry 1.8.7: **70 tests passed, 0 failed, 0 skipped**, across 10 suites (Sale 12, Finalize 16, Refund 5, Reveal 5, Token 15 including the Guardian H-01, H-02, M-01, M-03 regressions, Renderer 7, Params 8, Invariant 2). Website: `vitest` 56 tests in 3 files (2 further files are generators that only run on request), including a byte-for-byte renderer comparison, a contrast audit of 35 colour pairs and the Pages Function policy tests. End to end: 20 browser steps against a local anvil chain (buy, refund path, finalize, reveal, gallery, naming, sending, geoblock view-only).

Gas measured on anvil: `finalizeLaunch` about 1.41M, `tokenURI` full path 280-360k, worst-case renderer call 925,894 (under the 3M budget the test enforces).

## 7. Design decisions an auditor should challenge

- **Exact price parity by rounding to the treasury.** The pool receives `tLP = floor(raised * liquidityBps / 10000 / price)` whole tokens (capped by unsold supply) and exactly `tLP * price` ETH. The rounding remainder goes to the treasury.
- **Pair pre-creation and donations.** Anyone can create the pair early or donate tokens/WETH to it. `finalizeLaunch` `skim`s unsynced donations to the treasury, and for a synced WETH donation it mints extra tokens (capped by room under `maxSupply`) so the opening price still matches. A huge donation cannot block finalization (`test_hugeSyncedDonationCannotExceedSupplyCapOrBlockFinalize`).
- **Trading opens inside finalization, before the pool calls**, because Uniswap's `skim` transfers (even zero-value) hit the transfer lock otherwise. The lock is `!tradingOpen && from != launcher`.
- **Permit2 default allowance disabled** (`_givePermit2DefaultInfiniteAllowance` returns false), so no spender has an implicit infinite allowance.
- **skipNFT initialisation.** `mintSale` sets "receive NFTs" for buyers whose flag is uninitialised, because DN404 would default contracts and EIP-7702 accounts to skipNFT. The pool, sink and launcher are explicitly marked skipNFT.
- **Reentrancy.** Solady `ReentrancyGuardTransient`, forced to use transient storage on every chain (`_useTransientReentrancyGuardOnlyOnMainnet()` returns false). Robinhood Chain supports TSTORE (verified in session; see `DECISIONS.md`). Effects precede interactions in every function.
- **Reveal window is a duration after finalization** (`revealWindow`), not an absolute date, so a late finalization cannot leave the revealer with no time.
- **Time source.** `block.timestamp` comes from the sequencer on this chain. All windows are at least one hour (`MIN_WINDOW`); nothing depends on second-level precision.
- **Treasury is pull-only.** A treasury that rejects ETH cannot block finalization (`test_rejectingTreasuryDoesNotBlockFinalize`).
- **Minimum sold to finalize.** At least one liquidity token must be mintable; otherwise `NotFinalizable`, and the refund path opens after the window.

## 8. Known risks and limitations (not bugs by design)

1. **DN404 behaviour.** Sending a fraction of a token burns or mints NFTs. Wallets and exchanges treat the asset as ERC-20. The site warns before partial transfers. Supply at sell-out is 2,221, not 2,222, because the sale cap is the floor of 60% of 2,222 (1,333) and the pool gets whole tokens only; the displayed text says "at most".
2. **Reveal is not trustless against the revealer for one bit.** The revealer knows the secret before finalization and can compute the seed once `entropy` is final, so can choose not to reveal (forcing the fallback seed `keccak256(entropy, commit)`), which is also predictable at that point. The effect is a choice between two seeds, not control over individual outcomes. Mitigation: the commitment is public before the sale; the revealer cannot change it.
3. **Wallet cap is per address** and can be bypassed with many addresses. It is a friction measure, not a guarantee of distribution.
4. **Geoblocking is interface-only.** The site switches to view-only based on the hosting platform's country header (Cloudflare's `request.cf.country` or Vercel's `x-vercel-ip-country`, depending on where the site is deployed). The contracts are permissionless and cannot enforce jurisdictional limits.
5. **Pair behaviour** depends on the Uniswap V2 deployment at the configured factory. On mainnet the factory has `feeTo` set (protocol fee); this is recorded and does not break the price parity test but affects LP value over time. The code refuses factory/WETH addresses without code, and `Deploy.s.sol` pins the official addresses on mainnet.
6. **Names** are public and permanent in chain history even though the displayed name is dropped when the NFT changes owner.
7. **Renderer gas.** `tokenURI` is a view; public RPC `eth_call` has a 50M gas cap, far above the measured worst case.
8. **Library risk.** DN404 and Solady are used as audited by others at the pinned commits, but this packet does not re-audit them.

## 9. Forge lint exclusions

`forge lint` runs on every build. Excluded globally in `foundry.toml`: `uninitialized-local`, `encode-packed-collision` (all `abi.encodePacked` inputs are fixed-width), `block-timestamp` (hour-scale windows), `require-revert-in-loop`. Inline `forge-lint: disable-next-line(...)` comments each carry a reason (events before external calls where the lint cannot see the guard modifier; calls to contracts this launcher deployed).

## 9b. Slither (0.11.6, `contracts/src` only, informational findings excluded)

`slither . --foundry-out-directory out --filter-paths "lib/|test/|script/" --exclude-informational` analysed 14 contracts with 81 detectors and reported 27 results. None needed a code change; each was triaged:

| Detector (count) | Impact | Triage |
| --- | --- | --- |
| `encode-packed-collision` (4) | High | False positive. The calls concatenate SVG string fragments into output; nothing is hashed from them. Every `abi.encodePacked` that feeds `keccak256` uses fixed-width types only. |
| `divide-before-multiply` (3) | Medium | Intentional. `liquiditySplit` rounds the pool's token count down to whole tokens and then prices it (`tLP * mintPrice`) so the pool opens at exactly the sale price; the remainder goes to the treasury. Renderer `_slot` computes a fixed lattice. Both are covered by tests (`testFuzz_priceParityForAnySaleSize`, golden renderer tests). |
| `uninitialized-local` (12) | Medium | Intentional zero defaults (counters, accumulators, bitmaps in the renderer). |
| `unused-return` (1) | Medium | `getReserves()` timestamp is not needed. |
| `reentrancy-benign` (1) | Low | `pair` is stored after `factory.createPair`; the factory is fixed at deployment and `finalizeLaunch` is `nonReentrant`. |
| `timestamp` (6) | Low | Known. All windows are at least one hour (`MIN_WINDOW`). |

## 10. How to reproduce

```
cd contracts
./install-deps.sh          # clones the pinned commits and checks them
forge build                # compiles with deny_warnings and lint (downloads solc 0.8.28 on first use)
forge test                 # 70 tests, a few minutes at most on a laptop
```

The site reproduces the art independently: `cd web && pnpm install && pnpm test`.

## 11. Not done

External audit; Aderyn; formal verification; a testnet deployment (the owner deploys); a mainnet fork test of the launcher against the live Uniswap V2 (the fork would need the public RPC, which this build environment could not reach; the deployment is instead checked by `pnpm verify:deployment` after the owner deploys).
