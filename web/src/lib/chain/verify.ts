import { keccak256, type Address, type Hex } from "viem";
import expected from "@/generated/expected-code.json";
import { chain } from "./chains";
import { publicClient } from "./client";

export type ContractName = keyof typeof expected;

export function maskImmutables(code: Hex, refs: readonly { start: number; length: number }[]): Hex {
  const hex = code.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  for (const { start, length } of refs) bytes.fill(0, start, start + length);
  let out = "0x";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out as Hex;
}

/** True when the on-chain runtime code equals this build's code, with immutable slots masked. */
export async function codeMatches(address: Address, name: ContractName): Promise<boolean> {
  const code = await publicClient().getCode({ address });
  if (!code || code === "0x") return false;
  const e = expected[name];
  return keccak256(maskImmutables(code, e.immutableRefs)) === e.codeHashMasked;
}

/** Asks the chain's Blockscout API whether source is verified. Null if the explorer cannot be reached. */
export async function sourceVerified(address: Address): Promise<boolean | null> {
  const api = chain.blockExplorers?.default.url;
  if (!api) return null;
  try {
    const r = await fetch(`${api}/api/v2/smart-contracts/${address}`, { headers: { accept: "application/json" } });
    if (r.status === 404) return false;
    if (!r.ok) return null;
    const j = (await r.json()) as { is_verified?: boolean };
    return j.is_verified === true;
  } catch {
    return null;
  }
}
