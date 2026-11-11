import { encodePacked, keccak256, type Hex } from "viem";

/**
 * Deterministic draw stream for one asterism.
 *
 * word(k) = keccak256(abi.encodePacked(bytes32 seed, uint32 id, uint32 k))
 * Each word yields eight 32-bit lanes, least significant first:
 *   lane(j) = (word >> (32 * j)) & 0xffffffff
 * draw(n) = nextLane() % n
 *
 * The Solidity renderer uses the same packing, so both produce identical sequences.
 */
export class DrawStream {
  private readonly seed: Hex;
  private readonly id: number;
  private wordIndex = 0;
  private lane = 8;
  private word = 0n;

  constructor(seed: Hex, id: number) {
    this.seed = seed;
    this.id = id;
  }

  private nextLane(): number {
    if (this.lane === 8) {
      this.word = BigInt(
        keccak256(encodePacked(["bytes32", "uint32", "uint32"], [this.seed, this.id, this.wordIndex])),
      );
      this.wordIndex += 1;
      this.lane = 0;
    }
    const value = Number((this.word >> BigInt(32 * this.lane)) & 0xffffffffn);
    this.lane += 1;
    return value;
  }

  /** Uniform-enough integer in [0, n). n must be in [1, 2^32). */
  draw(n: number): number {
    if (!Number.isInteger(n) || n < 1) throw new RangeError("draw(n) needs a positive integer");
    return this.nextLane() % n;
  }

  /** Integer in [lo, hi], inclusive. */
  between(lo: number, hi: number): number {
    return lo + this.draw(hi - lo + 1);
  }

  /** Number of 256-bit words consumed so far (used for gas estimates). */
  get wordsUsed(): number {
    return this.wordIndex;
  }
}
