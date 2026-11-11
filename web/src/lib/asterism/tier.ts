import { encodePacked, keccak256, type Hex } from "viem";
import { MAX_SUPPLY_TOKENS, TIER_COUNTS, type Tier } from "./spec";

/**
 * Keyed permutation of [0, MAX_SUPPLY_TOKENS) built from a 4-round balanced Feistel network
 * on 12 bits (two 6-bit halves, domain 4096) with cycle-walking.
 *
 * round(r, R) = uint256(keccak256(abi.encodePacked(bytes32 key, uint8 r, uint8 R))) & 63
 * (L, R) -> (R, L ^ round(r, R))
 *
 * Because it is a bijection on [0, N), every tier gets exactly TIER_COUNTS[t] positions
 * when all ids 1..N exist. No table of 2222 entries is stored.
 */
const HALF_BITS = 6;
const HALF_MASK = (1 << HALF_BITS) - 1;
const ROUNDS = 4;

function roundFn(key: Hex, r: number, half: number): number {
  const h = BigInt(keccak256(encodePacked(["bytes32", "uint8", "uint8"], [key, r, half])));
  return Number(h & BigInt(HALF_MASK));
}

function feistel(x: number, key: Hex): number {
  let left = x >> HALF_BITS;
  let right = x & HALF_MASK;
  for (let r = 0; r < ROUNDS; r++) {
    const next = left ^ roundFn(key, r, right);
    left = right;
    right = next;
  }
  return (left << HALF_BITS) | right;
}

export function permute(index: number, key: Hex, domain = MAX_SUPPLY_TOKENS): number {
  if (!Number.isInteger(index) || index < 0 || index >= domain) throw new RangeError("index out of domain");
  let y = feistel(index, key);
  while (y >= domain) y = feistel(y, key);
  return y;
}

/** Cumulative upper bounds, e.g. [1200, 1800, 2100, 2200, 2222]. */
export const TIER_BOUNDS: readonly number[] = TIER_COUNTS.reduce<number[]>((acc, c) => {
  acc.push((acc.at(-1) ?? 0) + c);
  return acc;
}, []);

export function tierOfPosition(position: number): Tier {
  for (let t = 0; t < TIER_BOUNDS.length; t++) {
    if (position < (TIER_BOUNDS[t] as number)) return t as Tier;
  }
  throw new RangeError("position out of range");
}

/** Tier of a 1-indexed token id. */
export function tierOf(id: number, seed: Hex): Tier {
  return tierOfPosition(permute(id - 1, seed));
}
