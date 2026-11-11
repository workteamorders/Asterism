#!/usr/bin/env node
// Read-only pre-deployment check. It sends no transaction and needs no key: it only reads the config file, your reveal
// secret file (to compare its hash, never printing it) and public chain data (eth_chainId, eth_getCode, eth_call, eth_getBalance).
//
//   node scripts/preflight.mjs --chain 4663 [--rpc <url>] [--deployer 0x...] [--secret-file <path>] [--config <path>]
//
// Exit code 1 if any check FAILS. WARN items need your decision. Run it again right before deploying.
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(join(repo, "web", "package.json"));
const viem = await import(pathToFileURL(requireFromWeb.resolve("viem")).href);
const { createPublicClient, http, keccak256, isAddress, getAddress, parseAbi, formatEther } = viem;

export const MAINNET = {
  chainId: 4663,
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  factory: "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
};
const HOUR = 3600;

/** Pure checks on the config file. Returns [{level: "PASS"|"WARN"|"FAIL", text}]. */
export function checkConfig(cfg, now, chainId) {
  const out = [];
  const add = (level, text) => out.push({ level, text });
  const raw = JSON.stringify(cfg);
  if (raw.includes("REPLACE")) add("FAIL", "config still contains REPLACE_ placeholders");
  if (cfg._notes) add("WARN", "config still has a _notes field; remove it");
  const price = (() => { try { return BigInt(cfg.mintPriceWei); } catch { return 0n; } })();
  if (price <= 0n) add("FAIL", "mintPriceWei is not a positive integer");
  else add("PASS", `mint price ${formatEther(price)} ETH per whole token (permanent). Full sale of 1,333 tokens raises ${formatEther(price * 1333n)} ETH`);
  if (!(cfg.txCap >= 1 && cfg.walletCap >= cfg.txCap)) add("FAIL", "txCap must be >= 1 and walletCap >= txCap");
  else add("PASS", `caps: ${cfg.txCap} per transaction, ${cfg.walletCap} per wallet`);
  if (!Number.isInteger(cfg.saleStart) || !Number.isInteger(cfg.saleEnd)) add("FAIL", "saleStart and saleEnd must be unix seconds (integers)");
  else {
    if (cfg.saleStart <= now + HOUR) add("FAIL", "saleStart must be more than one hour after the moment you deploy");
    else if (cfg.saleStart < now + 24 * HOUR && chainId === MAINNET.chainId) add("WARN", "saleStart is less than 24 hours away; announce parameters first");
    else add("PASS", `saleStart ${new Date(cfg.saleStart * 1000).toISOString()}`);
    if (cfg.saleEnd < cfg.saleStart + HOUR) add("FAIL", "saleEnd must be at least one hour after saleStart");
    else add("PASS", `sale window ${((cfg.saleEnd - cfg.saleStart) / HOUR).toFixed(1)} hours, ends ${new Date(cfg.saleEnd * 1000).toISOString()}`);
  }
  for (const k of ["finalizeWindowSeconds", "revealWindowSeconds"]) {
    if (!(cfg[k] >= HOUR)) add("FAIL", `${k} must be at least 3600`);
    else add("PASS", `${k} = ${(cfg[k] / HOUR).toFixed(1)} hours`);
  }
  for (const k of ["treasury", "weth", "uniswapV2Factory"]) {
    if (!isAddress(String(cfg[k]), { strict: false })) add("FAIL", `${k} is not an address`);
  }
  if (isAddress(String(cfg.treasury), { strict: false }) && /^0x0{40}$/i.test(cfg.treasury)) add("FAIL", "treasury is the zero address");
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(cfg.revealCommit)) || /^0x0{64}$/.test(cfg.revealCommit)) add("FAIL", "revealCommit must be a non-zero bytes32");
  if (chainId === MAINNET.chainId) {
    if (String(cfg.weth).toLowerCase() !== MAINNET.weth.toLowerCase()) add("FAIL", "weth differs from the recorded official mainnet address");
    if (String(cfg.uniswapV2Factory).toLowerCase() !== MAINNET.factory.toLowerCase()) add("FAIL", "uniswapV2Factory differs from the recorded official mainnet address");
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
  const chainId = Number(flag("--chain") ?? "");
  if (![4663, 46630, 31337].includes(chainId)) { console.error("Usage: node scripts/preflight.mjs --chain <4663|46630|31337> [--rpc url] [--deployer 0x..] [--secret-file path] [--config path]"); process.exit(2); }
  const rpc = flag("--rpc") ?? (chainId === 4663 ? MAINNET.rpc : chainId === 46630 ? "https://rpc.testnet.chain.robinhood.com" : "http://127.0.0.1:8545");
  const cfgPath = resolve(flag("--config") ?? join(repo, "deployments", "config", `${chainId}.json`));
  const results = [];
  const add = (level, text) => results.push({ level, text });
  if (!existsSync(cfgPath)) { console.error(`Missing ${cfgPath}. Copy the .example.json next to it and fill it in.`); process.exit(2); }
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));

  const client = createPublicClient({ transport: http(rpc) });
  let live;
  try { live = await client.getChainId(); } catch (e) { console.error(`Cannot reach ${rpc}: ${e.shortMessage ?? e.message}`); process.exit(2); }
  if (live !== chainId) add("FAIL", `RPC reports chain ${live}, expected ${chainId}`);
  else add("PASS", `RPC is chain ${chainId}`);
  const block = await client.getBlock();
  results.push(...checkConfig(cfg, Number(block.timestamp), chainId));

  // Chain facts the constructor will also enforce.
  const codeLen = async (a) => { const c = await client.getCode({ address: a }); return c && c !== "0x" ? (c.length - 2) / 2 : 0; };
  for (const [label, addr] of [["WETH", cfg.weth], ["Uniswap V2 factory", cfg.uniswapV2Factory]]) {
    if (!isAddress(String(addr), { strict: false })) continue;
    const n = await codeLen(addr);
    if (n === 0) add("FAIL", `${label} ${addr} has no code on this chain`);
    else add("PASS", `${label} ${getAddress(addr)} has ${n} bytes of code (compare with the explorer and developers.uniswap.org yourself)`);
  }
  if (chainId === 4663) {
    const n = await codeLen(MAINNET.multicall3);
    add(n ? "PASS" : "WARN", `Multicall3 ${n ? "has code" : "has NO code; the site's batched reads will fail"}`);
  }
  if (isAddress(String(cfg.uniswapV2Factory), { strict: false }) && (await codeLen(cfg.uniswapV2Factory))) {
    try {
      const abi = parseAbi(["function feeTo() view returns (address)", "function allPairsLength() view returns (uint256)"]);
      const [feeTo, pairs] = await Promise.all([
        client.readContract({ address: cfg.uniswapV2Factory, abi, functionName: "feeTo" }),
        client.readContract({ address: cfg.uniswapV2Factory, abi, functionName: "allPairsLength" }),
      ]);
      add("PASS", `factory answers: ${pairs} pairs, feeTo ${feeTo}`);
      if (feeTo !== "0x0000000000000000000000000000000000000000") add("WARN", "factory feeTo is set: the protocol takes part of LP growth. Read the risk text on /risk/ against this");
    } catch { add(chainId === MAINNET.chainId ? "FAIL" : "WARN", "factory does not answer feeTo()/allPairsLength(); on mainnet that means it is not a V2 factory (stand-in factories on local or testnet may not implement them)"); }
  }
  if (isAddress(String(cfg.treasury), { strict: false })) {
    const n = await codeLen(cfg.treasury);
    if (n) add("PASS", `treasury ${getAddress(cfg.treasury)} is a contract (${n} bytes). Confirm it is your multisig and that it can receive plain ETH`);
    else add("WARN", `treasury ${getAddress(cfg.treasury)} is a plain account (EOA). A multisig is recommended; the address is permanent`);
  }
  const deployer = flag("--deployer");
  if (deployer && isAddress(deployer)) {
    const bal = await client.getBalance({ address: deployer });
    add(bal > 0n ? "PASS" : "FAIL", `deployer ${getAddress(deployer)} balance ${formatEther(bal)} ETH (compare with the gas estimate from the simulation)`);
    if (isAddress(String(cfg.treasury)) && getAddress(cfg.treasury) === getAddress(deployer)) add("WARN", "treasury equals the deployer; consider a separate multisig");
  } else add("WARN", "no --deployer given; balance not checked");

  // The reveal secret must hash to revealCommit, or the seed can only come from the public fallback.
  const secretFile = resolve(flag("--secret-file") ?? join(homedir(), ".asterism", `reveal-secret-${chainId === 4663 ? "mainnet" : chainId === 46630 ? "testnet" : "launch"}.txt`));
  if (!existsSync(secretFile)) add("FAIL", `reveal secret file not found at ${secretFile}`);
  else {
    const mode = statSync(secretFile).mode & 0o777;
    if (mode & 0o077) add("WARN", `secret file permissions are ${mode.toString(8)}; run chmod 600`);
    const secret = readFileSync(secretFile, "utf8").trim().split(/\s+/).find((t) => /^0x[0-9a-fA-F]{64}$/.test(t));
    if (!secret) add("FAIL", "secret file has no 0x… bytes32 value");
    else add(keccak256(secret).toLowerCase() === String(cfg.revealCommit).toLowerCase() ? "PASS" : "FAIL", keccak256(secret).toLowerCase() === String(cfg.revealCommit).toLowerCase() ? "reveal secret matches revealCommit (value not shown)" : "reveal secret does NOT match revealCommit");
  }
  add(process.env.ASTERISM_MAINNET_ACK ? "WARN" : "PASS", process.env.ASTERISM_MAINNET_ACK ? "ASTERISM_MAINNET_ACK is set in this shell; set it only for the deploy command itself" : "ASTERISM_MAINNET_ACK is not set (set it only right before deploying)");
  for (const v of ["PRIVATE_KEY", "ETH_PRIVATE_KEY", "DEPLOYER_PRIVATE_KEY", "MNEMONIC"]) if (process.env[v]) add("FAIL", `${v} is set in this shell; unset it`);

  let failed = 0, warned = 0;
  for (const r of results) { console.log(`${r.level.padEnd(4)}  ${r.text}`); if (r.level === "FAIL") failed++; if (r.level === "WARN") warned++; }
  console.log(`\n${failed} failed, ${warned} to decide, ${results.length - failed - warned} passed. Nothing was sent to the network.`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
