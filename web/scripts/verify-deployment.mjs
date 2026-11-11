// pnpm verify:deployment -- --chain <id> [--rpc <url>]
// Read-only. Checks, on-chain, that every address in ../deployments/<chainId>.json runs the code from this build
// (immutable slots masked) and that every published constant matches the chain and the specification.
// Exit code 1 on any mismatch.
import { readFileSync } from "node:fs";
import { createPublicClient, http, keccak256, getAddress } from "viem";

const SPEC = {
  maxSupplyTokens: 2222n, saleBps: 6000n, liquidityProceedsBps: 6667n, treasuryProceedsBps: 3333n,
  tierCounts: [1200n, 600n, 300n, 100n, 22n], starRanges: [[5n, 6n], [7n, 8n], [9n, 10n], [11n, 13n], [14n, 16n]], nameMaxBytes: 48n,
};
const PUBLIC_RPC = { 4663: "https://rpc.mainnet.chain.robinhood.com", 46630: "https://rpc.testnet.chain.robinhood.com", 31337: "http://127.0.0.1:8545" };

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const chainId = Number(args.chain ?? process.env.CHAIN_ID ?? 4663);
const rpc = args.rpc ?? process.env.RPC_URL ?? PUBLIC_RPC[chainId];
const dep = JSON.parse(readFileSync(new URL(`../../deployments/${chainId}.json`, import.meta.url), "utf8"));
const abis = JSON.parse(readFileSync(new URL("../src/generated/abis.json", import.meta.url), "utf8"));
const expected = JSON.parse(readFileSync(new URL("../src/generated/expected-code.json", import.meta.url), "utf8"));
const client = createPublicClient({ transport: http(rpc) });

const results = [];
const check = (label, ok, detail = "") => results.push({ label, ok: Boolean(ok), detail });
const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

function maskImmutables(hex, refs) {
  const bytes = Buffer.from(hex.replace(/^0x/, ""), "hex");
  for (const { start, length } of refs) bytes.fill(0, start, start + length);
  return `0x${bytes.toString("hex")}`;
}

const a = dep.addresses;
for (const k of ["renderer", "launcher", "token", "mirror", "sink"]) {
  if (!a[k]) {
    console.error(`deployments/${chainId}.json has no ${k} address: not deployed yet.`);
    process.exit(1);
  }
}
check("chain id", (await client.getChainId()) === chainId, `expected ${chainId}`);
const CODE = { renderer: "AsterismRenderer", launcher: "AsterismLauncher", token: "AsterismToken", mirror: "DN404Mirror", sink: "LiquiditySink" };
for (const [k, name] of Object.entries(CODE)) {
  const code = await client.getCode({ address: a[k] });
  const ok = code && code !== "0x" && keccak256(maskImmutables(code, expected[name].immutableRefs)) === expected[name].codeHashMasked;
  check(`code of ${k} (${name})`, ok, a[k]);
}
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
const L = abis.AsterismLauncher, T = abis.AsterismToken, R = abis.AsterismRenderer, M = abis.DN404Mirror;
const p = dep.params;
const lv = async (fn) => read(a.launcher, L, fn);
check("launcher.token", eq(await lv("token"), a.token));
check("launcher.renderer", eq(await lv("renderer"), a.renderer));
check("launcher.sink", eq(await lv("sink"), a.sink));
check("token.launcher", eq(await read(a.token, T, "launcher"), a.launcher));
check("token.renderer", eq(await read(a.token, T, "renderer"), a.renderer));
check("token.mirror", eq(await read(a.token, T, "mirrorERC721"), a.mirror));
check("mirror.baseERC20", eq(await read(a.mirror, M, "baseERC20"), a.token));
check("mirror.owner is zero", eq(await read(a.mirror, M, "owner"), "0x0000000000000000000000000000000000000000"));
check("token.maxSupply", (await read(a.token, T, "maxSupply")) === SPEC.maxSupplyTokens * 10n ** 18n);
check("token.name", (await read(a.token, T, "name")) === p.name, p.name);
check("token.symbol", (await read(a.token, T, "symbol")) === p.symbol, p.symbol);
for (const [fn, want] of [["maxSupplyTokens", SPEC.maxSupplyTokens], ["saleBps", SPEC.saleBps], ["liquidityProceedsBps", SPEC.liquidityProceedsBps], ["treasuryProceedsBps", SPEC.treasuryProceedsBps]]) {
  check(`launcher.${fn} = spec`, (await lv(fn)) === want, String(want));
}
for (const [fn, want] of [["mintPrice", BigInt(p.mintPriceWei)], ["walletCap", BigInt(p.walletCap)], ["txCap", BigInt(p.txCap)], ["saleStart", BigInt(p.saleStart)], ["saleEnd", BigInt(p.saleEnd)], ["finalizeWindow", BigInt(p.finalizeWindowSeconds)], ["revealWindow", BigInt(p.revealWindowSeconds)]]) {
  check(`launcher.${fn} = published`, (await lv(fn)) === want, String(want));
}
for (const [fn, want] of [["treasury", p.treasury], ["revealCommit", p.revealCommit], ["weth", p.weth], ["factory", p.uniswapV2Factory]]) {
  check(`launcher.${fn} = published`, eq(await lv(fn), want), want);
}
check("renderer.maxSupply = spec", (await read(a.renderer, R, "maxSupply")) === SPEC.maxSupplyTokens);
const counts = await read(a.renderer, R, "tierCounts");
check("renderer.tierCounts = spec", counts.every((c, i) => c === SPEC.tierCounts[i]), SPEC.tierCounts.join("/"));
for (let t = 0; t < 5; t++) {
  const [lo, hi] = await read(a.renderer, R, "starRange", [BigInt(t)]);
  check(`renderer.starRange(${t}) = spec`, lo === SPEC.starRanges[t][0] && hi === SPEC.starRanges[t][1]);
}
check("renderer.NAME_MAX_BYTES = spec", (await read(a.renderer, R, "NAME_MAX_BYTES")) === SPEC.nameMaxBytes);
if (chainId === 4663) {
  check("mainnet WETH", eq(p.weth, getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73")));
  check("mainnet Uniswap V2 factory", eq(p.uniswapV2Factory, "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f"));
}

const width = Math.max(...results.map((r) => r.label.length));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} checks passed for chain ${chainId}.`);
process.exit(failed ? 1 : 0);
