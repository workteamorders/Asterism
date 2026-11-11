// Read-only JSON-RPC forwarding policy for /api/rpc. Pure functions, unit-tested in test/functions.test.ts.
import { decodeFunctionData, getAddress, isAddress, parseAbi, type Hex } from "viem";

export const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getBalance",
  "eth_getCode",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getLogs",
]);

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_BATCH = 25;
export const DEFAULT_MAX_LOG_RANGE = 10_000;
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

const MULTICALL_ABI = parseAbi([
  "struct Call3 { address target; bool allowFailure; bytes callData; }",
  "function aggregate3(Call3[] calls) payable returns ((bool success, bytes returnData)[])",
]);

export interface RpcCall {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown[];
}

export interface PolicyConfig {
  /** Project contract addresses (lowercase or checksummed). eth_call, eth_estimateGas and eth_getLogs may only target these. */
  projectAddresses: Set<string>;
  maxLogRange: number;
}

export type Verdict = { ok: true } | { ok: false; status: number; message: string };

const deny = (status: number, message: string): Verdict => ({ ok: false, status, message });

function isHexQuantity(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(v);
}

function inProject(addr: unknown, cfg: PolicyConfig): boolean {
  return typeof addr === "string" && isAddress(addr, { strict: false }) && cfg.projectAddresses.has(getAddress(addr).toLowerCase());
}

function checkCallTarget(tx: unknown, cfg: PolicyConfig): Verdict {
  if (!tx || typeof tx !== "object") return deny(400, "Invalid call object.");
  const { to, data, input } = tx as { to?: unknown; data?: unknown; input?: unknown };
  if (typeof to !== "string" || !isAddress(to, { strict: false })) return deny(403, "Calls must target a contract.");
  if (inProject(to, cfg)) return { ok: true };
  if (getAddress(to) === getAddress(MULTICALL3)) {
    const calldata = (typeof data === "string" ? data : typeof input === "string" ? input : "") as Hex;
    try {
      const decoded = decodeFunctionData({ abi: MULTICALL_ABI, data: calldata });
      const calls = decoded.args[0] as readonly { target: string }[];
      if (calls.length > 500) return deny(413, "Too many calls in one multicall.");
      return calls.every((c) => inProject(c.target, cfg)) ? { ok: true } : deny(403, "Multicall may only read project contracts.");
    } catch {
      return deny(403, "Only aggregate3 multicalls are allowed.");
    }
  }
  return deny(403, "Calls may only target project contracts.");
}

export function checkCall(call: unknown, cfg: PolicyConfig): Verdict {
  if (!call || typeof call !== "object" || Array.isArray(call)) return deny(400, "Invalid JSON-RPC request.");
  const c = call as Partial<RpcCall>;
  if (c.jsonrpc !== "2.0" || typeof c.method !== "string") return deny(400, "Invalid JSON-RPC request.");
  if (c.params !== undefined && !Array.isArray(c.params)) return deny(400, "Invalid JSON-RPC params.");
  if (c.id !== undefined && c.id !== null && typeof c.id !== "string" && typeof c.id !== "number") return deny(400, "Invalid JSON-RPC id.");
  if (!ALLOWED_METHODS.has(c.method)) return deny(403, "Method not allowed.");
  const params = c.params ?? [];
  switch (c.method) {
    case "eth_call":
    case "eth_estimateGas":
      return checkCallTarget(params[0], cfg);
    case "eth_getLogs": {
      const f = params[0] as { address?: unknown; fromBlock?: unknown; toBlock?: unknown; blockHash?: unknown } | undefined;
      if (!f || typeof f !== "object") return deny(400, "Invalid log filter.");
      const addrs = Array.isArray(f.address) ? f.address : [f.address];
      if (addrs.length === 0 || addrs.length > 5 || !addrs.every((a) => inProject(a, cfg))) return deny(403, "Logs may only be read for project contracts.");
      if (f.blockHash !== undefined) return typeof f.blockHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(f.blockHash) ? { ok: true } : deny(400, "Invalid block hash.");
      if (!isHexQuantity(f.fromBlock) || !isHexQuantity(f.toBlock)) return deny(400, "Log ranges need numeric fromBlock and toBlock.");
      const from = BigInt(f.fromBlock);
      const to = BigInt(f.toBlock);
      if (to < from) return deny(400, "toBlock is before fromBlock.");
      if (to - from > BigInt(cfg.maxLogRange)) return deny(413, `Log range is limited to ${cfg.maxLogRange} blocks.`);
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

export function checkBatch(body: unknown, cfg: PolicyConfig): { calls: RpcCall[] } | Verdict {
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > MAX_BATCH) return deny(400, `Batches hold 1 to ${MAX_BATCH} calls.`);
  for (const c of calls) {
    const v = checkCall(c, cfg);
    if (!v.ok) return v;
  }
  return { calls: calls as RpcCall[] };
}

export function parseAddresses(list: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const raw of (list ?? "").split(",")) {
    const a = raw.trim();
    if (a && isAddress(a, { strict: false })) out.add(getAddress(a).toLowerCase());
  }
  return out;
}

export function parseOrigins(list: string | undefined, requestUrl: string): Set<string> {
  const out = new Set<string>([new URL(requestUrl).origin]);
  for (const raw of (list ?? "").split(",")) {
    const o = raw.trim();
    if (!o) continue;
    try {
      out.add(new URL(o).origin);
    } catch {
      /* ignore malformed entries */
    }
  }
  return out;
}
