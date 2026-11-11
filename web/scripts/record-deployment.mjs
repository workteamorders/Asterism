// Reads a Foundry broadcast and writes ../deployments/<chainId>.json in the format the site and
// verify:deployment expect. Read-only RPC calls only.
//   node scripts/record-deployment.mjs --chain 46630 --rpc <url> [--script Deploy.s.sol|LocalDemo.s.sol]
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, http, getAddress } from "viem";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const chainId = Number(args.chain);
const script = args.script ?? "Deploy.s.sol";
if (!chainId || !args.rpc) throw new Error("usage: --chain <id> --rpc <url> [--script Deploy.s.sol]");
const abis = JSON.parse(readFileSync(new URL("../src/generated/abis.json", import.meta.url), "utf8"));
const run = JSON.parse(readFileSync(new URL(`../../contracts/broadcast/${script}/${chainId}/run-latest.json`, import.meta.url), "utf8"));
const created = (name) => {
  const tx = run.transactions.find((t) => t.transactionType === "CREATE" && t.contractName === name);
  if (!tx) throw new Error(`no CREATE for ${name} in broadcast`);
  return getAddress(tx.contractAddress);
};
const client = createPublicClient({ transport: http(args.rpc) });
const live = await client.getChainId();
if (live !== chainId) throw new Error(`RPC is chain ${live}, expected ${chainId}`);
const launcher = created("AsterismLauncher");
const renderer = created("AsterismRenderer");
const read = (address, abi, functionName) => client.readContract({ address, abi, functionName });
const L = abis.AsterismLauncher;
const token = await read(launcher, L, "token");
const mirror = await read(token, abis.AsterismToken, "mirrorERC721");
const sink = await read(launcher, L, "sink");
const receipt = await client.getTransactionReceipt({ hash: run.receipts.find((r) => r.contractAddress && getAddress(r.contractAddress) === launcher).transactionHash });
const params = {
  name: await read(token, abis.AsterismToken, "name"),
  symbol: await read(token, abis.AsterismToken, "symbol"),
  mintPriceWei: String(await read(launcher, L, "mintPrice")),
  walletCap: Number(await read(launcher, L, "walletCap")),
  txCap: Number(await read(launcher, L, "txCap")),
  saleStart: Number(await read(launcher, L, "saleStart")),
  saleEnd: Number(await read(launcher, L, "saleEnd")),
  finalizeWindowSeconds: Number(await read(launcher, L, "finalizeWindow")),
  revealWindowSeconds: Number(await read(launcher, L, "revealWindow")),
  treasury: await read(launcher, L, "treasury"),
  revealCommit: await read(launcher, L, "revealCommit"),
  weth: await read(launcher, L, "weth"),
  uniswapV2Factory: await read(launcher, L, "factory"),
};
const NETWORK = { 4663: ["Robinhood Chain", "https://robinhoodchain.blockscout.com"], 46630: ["Robinhood Chain Testnet", "https://explorer.testnet.chain.robinhood.com"], 31337: ["Local anvil", ""] };
const out = {
  chainId,
  network: NETWORK[chainId]?.[0] ?? `Chain ${chainId}`,
  explorer: NETWORK[chainId]?.[1] ?? "",
  deployedAtBlock: Number(receipt.blockNumber),
  addresses: { renderer, launcher, token, mirror, sink },
  params,
  auditReportUrl: "",
};
writeFileSync(new URL(`../../deployments/${chainId}.json`, import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
console.log(out);
