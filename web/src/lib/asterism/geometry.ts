import type { Hex } from "viem";
import { DrawStream } from "./prng";
import {
  ATTEMPTS_PER_STAR,
  BRIGHTNESS_WEIGHTS,
  FIELD,
  LATTICE,
  MIN_DIST_SQ,
  TIER_STARS,
  type Guide,
  type Tier,
} from "./spec";
import { tierOf } from "./tier";

export interface Star {
  x: number;
  y: number;
  /** Brightness class 0, 1 or 2. */
  b: number;
}

export interface Asterism {
  id: number;
  tier: Tier;
  stars: Star[];
  /** Index into stars of the primary star that carries the tier mark. */
  primary: number;
  /** Minimum spanning tree edges as index pairs. */
  edges: [number, number][];
  guide: Guide;
  /** How many stars came from the lattice fallback (normally 0). */
  fallbackStars: number;
  wordsUsed: number;
}

export function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function isFree(p: { x: number; y: number }, placed: Star[]): boolean {
  for (const q of placed) if (distSq(p, q) < MIN_DIST_SQ) return false;
  return true;
}

/** Lattice slots in row-major order. */
export function latticeSlots(): { x: number; y: number }[] {
  const slots: { x: number; y: number }[] = [];
  for (let row = 0, y = FIELD.y0; y <= FIELD.y1; row++, y += LATTICE.rowPitch) {
    const shift = row % 2 === 1 ? LATTICE.oddShift : 0;
    for (let x = FIELD.x0 + shift; x <= FIELD.x1; x += LATTICE.colPitch) slots.push({ x, y });
  }
  return slots;
}

const SLOTS = latticeSlots();

function brightness(s: DrawStream): number {
  const total = BRIGHTNESS_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = s.draw(total);
  for (let i = 0; i < BRIGHTNESS_WEIGHTS.length; i++) {
    r -= BRIGHTNESS_WEIGHTS[i] as number;
    if (r < 0) return i;
  }
  return 0;
}

export function placeStars(
  s: DrawStream,
  count: number,
  attempts = ATTEMPTS_PER_STAR,
): { stars: Star[]; fallback: number } {
  const stars: Star[] = [];
  let fallback = 0;
  const w = FIELD.x1 - FIELD.x0 + 1;
  const h = FIELD.y1 - FIELD.y0 + 1;
  for (let i = 0; i < count; i++) {
    let placed: { x: number; y: number } | null = null;
    for (let a = 0; a < attempts && placed === null; a++) {
      const p = { x: FIELD.x0 + s.draw(w), y: FIELD.y0 + s.draw(h) };
      if (isFree(p, stars)) placed = p;
    }
    if (placed === null) {
      // Deterministic fallback: scan lattice slots from a drawn offset. Always succeeds (see spec.ts).
      const start = s.draw(SLOTS.length);
      for (let k = 0; k < SLOTS.length && placed === null; k++) {
        const slot = SLOTS[(start + k) % SLOTS.length] as { x: number; y: number };
        if (isFree(slot, stars)) placed = slot;
      }
      if (placed === null) throw new Error("lattice fallback exhausted (spec violated)");
      fallback += 1;
    }
    stars.push({ x: placed.x, y: placed.y, b: brightness(s) });
  }
  return { stars, fallback };
}

/** Prim's algorithm, O(n^2), squared integer distances, ties broken by lower index. */
export function minimumSpanningTree(points: { x: number; y: number }[]): [number, number][] {
  const n = points.length;
  const inTree = new Array<boolean>(n).fill(false);
  const best = new Array<number>(n).fill(Number.MAX_SAFE_INTEGER);
  const parent = new Array<number>(n).fill(-1);
  const edges: [number, number][] = [];
  best[0] = 0;
  for (let step = 0; step < n; step++) {
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!inTree[v] && (u === -1 || (best[v] as number) < (best[u] as number))) u = v;
    }
    inTree[u] = true;
    if (parent[u] !== -1) edges.push([parent[u] as number, u]);
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const d = distSq(points[u] as Star, points[v] as Star);
      if (d < (best[v] as number)) {
        best[v] = d;
        parent[v] = u;
      }
    }
  }
  return edges;
}

/** Proper intersection of segments ab and cd (shared endpoints do not count). */
export function segmentsCross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): boolean {
  const orient = (p: typeof a, q: typeof a, r: typeof a) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function buildAsterism(seed: Hex, id: number): Asterism {
  const tier = tierOf(id, seed);
  const s = new DrawStream(seed, id);
  const [lo, hi] = TIER_STARS[tier] as readonly [number, number];
  const count = s.between(lo, hi);
  const { stars, fallback } = placeStars(s, count);
  const primary = s.draw(count);
  const guide = s.draw(3) as Guide;
  const edges = minimumSpanningTree(stars);
  return { id, tier, stars, primary, edges, guide, fallbackStars: fallback, wordsUsed: s.wordsUsed };
}
