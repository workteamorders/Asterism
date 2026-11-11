import type { Address, Hex } from "viem";
import { launcherAbi, mirrorAbi, rendererAbi, tokenAbi } from "./abis";
import { hasMulticall } from "./chains";
import { publicClient } from "./client";
import { deployment } from "./deployment";

export const STATUS = ["NotStarted", "Sale", "AwaitingFinalization", "Trading", "Refunding"] as const;
export type Status = (typeof STATUS)[number];

export interface LauncherConfig {
  saleCap: bigint;
  mintPrice: bigint;
  walletCap: bigint;
  txCap: bigint;
  saleStart: bigint;
  saleEnd: bigint;
  finalizeWindow: bigint;
  revealWindow: bigint;
  liquidityProceedsBps: bigint;
  treasuryProceedsBps: bigint;
  maxSupplyTokens: bigint;
  treasury: Address;
  revealer: Address;
  revealCommit: Hex;
}

export interface LauncherState {
  status: Status;
  now: bigint;
  sold: bigint;
  saleCap: bigint;
  raised: bigint;
  refundedTotal: bigint;
  purchaseCount: bigint;
  finalized: boolean;
  finalizedAt: bigint;
  pair: Address;
  tokenLP: bigint;
  ethLP: bigint;
  treasuryAmount: bigint;
  treasuryWithdrawn: bigint;
  revealed: boolean;
  seed: Hex;
  revealDeadline: bigint;
  entropy: Hex;
  splitTokens: bigint;
  splitWei: bigint;
}

export interface UserState {
  purchased: bigint;
  paid: bigint;
  remaining: bigint;
  tokenBalance: bigint;
  nftBalance: bigint;
  ethBalance: bigint;
  skipNft: boolean;
}

function addrs() {
  const a = deployment.addresses;
  if (!a) throw new Error("not deployed");
  return a;
}

type Call = { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] };

/** Reads many view functions at once: Multicall3 when the chain has it, otherwise batched JSON-RPC. */
export async function readMany(calls: Call[]): Promise<unknown[]> {
  const c = publicClient();
  type MulticallArgs = Parameters<typeof c.multicall>[0];
  type ReadArgs = Parameters<typeof c.readContract>[0];
  if (hasMulticall) {
    const contracts = calls as unknown as MulticallArgs["contracts"];
    return (await c.multicall({ contracts, allowFailure: false })) as unknown[];
  }
  return Promise.all(calls.map((call) => c.readContract(call as unknown as ReadArgs)));
}

let configCache: Promise<LauncherConfig> | null = null;

export function readLauncherConfig(): Promise<LauncherConfig> {
  if (!configCache) {
    const { launcher } = addrs();
    const fns = [
      "saleCap", "mintPrice", "walletCap", "txCap", "saleStart", "saleEnd", "finalizeWindow", "revealWindow",
      "liquidityProceedsBps", "treasuryProceedsBps", "maxSupplyTokens", "treasury", "revealer", "revealCommit",
    ] as const;
    configCache = readMany(fns.map((functionName) => ({ address: launcher, abi: launcherAbi, functionName }))).then(
      (r) => Object.fromEntries(fns.map((f, i) => [f, r[i]])) as unknown as LauncherConfig,
    );
    configCache.catch(() => {
      configCache = null;
    });
  }
  return configCache;
}

export async function readLauncherState(): Promise<LauncherState> {
  const { launcher } = addrs();
  const [s, split] = (await readMany([
    { address: launcher, abi: launcherAbi, functionName: "state" },
    { address: launcher, abi: launcherAbi, functionName: "liquiditySplit" },
  ])) as [Record<string, unknown>, readonly [bigint, bigint]];
  return {
    status: STATUS[Number(s.status)] ?? "NotStarted",
    now: s.now_ as bigint,
    sold: s.sold as bigint,
    saleCap: s.saleCap as bigint,
    raised: s.raised as bigint,
    refundedTotal: s.refundedTotal as bigint,
    purchaseCount: s.purchaseCount as bigint,
    finalized: s.finalized as boolean,
    finalizedAt: s.finalizedAt as bigint,
    pair: s.pair as Address,
    tokenLP: s.tokenLP as bigint,
    ethLP: s.ethLP as bigint,
    treasuryAmount: s.treasuryAmount as bigint,
    treasuryWithdrawn: s.treasuryWithdrawn as bigint,
    revealed: s.revealed as boolean,
    seed: s.seed as Hex,
    revealDeadline: s.revealDeadline as bigint,
    entropy: s.entropy as Hex,
    splitTokens: split[0],
    splitWei: split[1],
  };
}

export async function readUser(account: Address): Promise<UserState> {
  const { launcher, token } = addrs();
  const [purchased, paid, remaining, tokenBalance, nftBalance, skipNft] = (await readMany([
    { address: launcher, abi: launcherAbi, functionName: "purchased", args: [account] },
    { address: launcher, abi: launcherAbi, functionName: "paid", args: [account] },
    { address: launcher, abi: launcherAbi, functionName: "remainingFor", args: [account] },
    { address: token, abi: tokenAbi, functionName: "balanceOf", args: [account] },
    { address: token, abi: tokenAbi, functionName: "nftBalanceOf", args: [account] },
    { address: token, abi: tokenAbi, functionName: "getSkipNFT", args: [account] },
  ])) as [bigint, bigint, bigint, bigint, bigint, boolean];
  const ethBalance = await publicClient().getBalance({ address: account });
  return { purchased, paid, remaining, tokenBalance, nftBalance, ethBalance, skipNft };
}

export async function readOwnedIds(account: Address): Promise<number[]> {
  const { token } = addrs();
  const ids = (await publicClient().readContract({
    address: token,
    abi: tokenAbi,
    functionName: "ownedIds",
    args: [account, 0n, 100_000n],
  })) as readonly bigint[];
  return ids.map(Number).sort((x, y) => x - y);
}

export interface TokenRecord {
  id: number;
  owner: Address;
  name: string;
}

/** Owners and visible names for ids 1..maxId, in chunks. Ids without an owner do not exist right now. */
export async function readTokens(maxId: number, chunk = 200): Promise<TokenRecord[]> {
  const { token } = addrs();
  const out: TokenRecord[] = [];
  for (let start = 1; start <= maxId; start += chunk) {
    const ids = Array.from({ length: Math.min(chunk, maxId - start + 1) }, (_, i) => start + i);
    const owners = (await readMany(ids.map((id) => ({ address: token, abi: tokenAbi, functionName: "ownerAt", args: [BigInt(id)] })))) as Address[];
    const named = (await readMany(ids.map((id) => ({ address: token, abi: tokenAbi, functionName: "namedBy", args: [BigInt(id)] })))) as Address[];
    const needName = ids.filter((_, i) => named[i] !== "0x0000000000000000000000000000000000000000" && named[i] === owners[i]);
    const names = needName.length
      ? ((await readMany(needName.map((id) => ({ address: token, abi: tokenAbi, functionName: "nameOf", args: [BigInt(id)] })))) as string[])
      : [];
    const nameById = new Map(needName.map((id, i) => [id, names[i] ?? ""]));
    ids.forEach((id, i) => {
      const owner = owners[i];
      if (owner && owner !== "0x0000000000000000000000000000000000000000") out.push({ id, owner, name: nameById.get(id) ?? "" });
    });
  }
  return out;
}

export async function readTotalSupply(): Promise<bigint> {
  const { token } = addrs();
  return (await publicClient().readContract({ address: token, abi: tokenAbi, functionName: "totalSupply" })) as bigint;
}

export async function readTokenUri(id: number): Promise<string> {
  const { mirror } = addrs();
  return (await publicClient().readContract({ address: mirror, abi: mirrorAbi, functionName: "tokenURI", args: [BigInt(id)] })) as string;
}

export async function readRendererSvg(id: number, seed: Hex, name: string): Promise<string> {
  const { renderer } = addrs();
  return (await publicClient().readContract({ address: renderer, abi: rendererAbi, functionName: "svg", args: [BigInt(id), seed, name] })) as string;
}
