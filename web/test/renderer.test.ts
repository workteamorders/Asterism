import { describe, expect, it } from "vitest";
import { keccak256, toHex, type Hex } from "viem";
import { DrawStream } from "@/lib/asterism/prng";
import { permute, tierOf } from "@/lib/asterism/tier";
import {
  buildAsterism,
  distSq,
  latticeSlots,
  minimumSpanningTree,
  placeStars,
  segmentsCross,
} from "@/lib/asterism/geometry";
import { renderAsterismSvg, renderUnrevealedSvg, validName } from "@/lib/asterism/svg";
import { MAX_SUPPLY_TOKENS, MIN_DIST_SQ, TIER_COUNTS, TIER_STARS, FIELD, MARK_RADIUS, READOUT_BASELINE, NAME_BASELINE } from "@/lib/asterism/spec";

const SEEDS: Hex[] = [
  keccak256(toHex("asterism-styleguide-example")),
  keccak256(toHex("asterism-test-seed-1")),
  keccak256(toHex("asterism-test-seed-2")),
];

const SAFE_SVG = /^[A-Za-z0-9 <>/="#.,:;!?'()\-]*$/;
const SVG_BYTE_LIMIT = 8192;

describe("tier permutation", () => {
  for (const seed of SEEDS) {
    it(`is a bijection with exact tier counts (seed ${seed.slice(0, 10)})`, () => {
      const seen = new Set<number>();
      const counts = [0, 0, 0, 0, 0];
      for (let id = 1; id <= MAX_SUPPLY_TOKENS; id++) {
        const p = permute(id - 1, seed);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(MAX_SUPPLY_TOKENS);
        seen.add(p);
        counts[tierOf(id, seed)]! += 1;
      }
      expect(seen.size).toBe(MAX_SUPPLY_TOKENS);
      expect(counts).toEqual([...TIER_COUNTS]);
    });
  }

  it("caps tier counts when the final supply is smaller (2221 ids)", () => {
    const counts = [0, 0, 0, 0, 0];
    for (let id = 1; id <= 2221; id++) counts[tierOf(id, SEEDS[0]!)]! += 1;
    counts.forEach((c, t) => expect(c).toBeLessThanOrEqual(TIER_COUNTS[t]!));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2221);
  });
});

describe("lattice fallback", () => {
  it("has more than 75 slots, all inside the field and pairwise >= MIN_DIST", () => {
    const slots = latticeSlots();
    expect(slots.length).toBeGreaterThan(75);
    for (const s of slots) {
      expect(s.x).toBeGreaterThanOrEqual(FIELD.x0);
      expect(s.x).toBeLessThanOrEqual(FIELD.x1);
      expect(s.y).toBeGreaterThanOrEqual(FIELD.y0);
      expect(s.y).toBeLessThanOrEqual(FIELD.y1);
    }
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++) expect(distSq(slots[i]!, slots[j]!)).toBeGreaterThanOrEqual(MIN_DIST_SQ);
  });

  it("always places 16 stars with zero random attempts", () => {
    for (let k = 0; k < 300; k++) {
      const s = new DrawStream(SEEDS[1]!, k + 1);
      const { stars, fallback } = placeStars(s, 16, 0);
      expect(fallback).toBe(16);
      for (let i = 0; i < stars.length; i++)
        for (let j = i + 1; j < stars.length; j++) expect(distSq(stars[i]!, stars[j]!)).toBeGreaterThanOrEqual(MIN_DIST_SQ);
    }
  });
});

describe("every asterism", () => {
  const seed = SEEDS[0]!;
  const svgs = new Set<string>();
  let fallbackStars = 0;
  let maxWords = 0;
  let maxBytes = 0;

  it("respects star counts, spacing, field bounds, tree shape, and SVG safety", () => {
    for (let id = 1; id <= MAX_SUPPLY_TOKENS; id++) {
      const a = buildAsterism(seed, id);
      const [lo, hi] = TIER_STARS[a.tier]!;
      expect(a.stars.length).toBeGreaterThanOrEqual(lo);
      expect(a.stars.length).toBeLessThanOrEqual(hi);
      for (const s of a.stars) {
        expect(s.x >= FIELD.x0 && s.x <= FIELD.x1 && s.y >= FIELD.y0 && s.y <= FIELD.y1).toBe(true);
      }
      for (let i = 0; i < a.stars.length; i++)
        for (let j = i + 1; j < a.stars.length; j++)
          expect(distSq(a.stars[i]!, a.stars[j]!)).toBeGreaterThanOrEqual(MIN_DIST_SQ);
      const pm = a.stars[a.primary]!;
      const reach = MARK_RADIUS[a.tier]!;
      expect(pm.y - reach).toBeGreaterThan(READOUT_BASELINE + 2);
      expect(pm.y + reach).toBeLessThan(NAME_BASELINE - 11);
      expect(pm.x - reach).toBeGreaterThan(8);
      expect(pm.x + reach).toBeLessThan(392);
      expect(a.edges.length).toBe(a.stars.length - 1);
      for (let e = 0; e < a.edges.length; e++)
        for (let f = e + 1; f < a.edges.length; f++) {
          const [p, q] = a.edges[e]!;
          const [r, t] = a.edges[f]!;
          expect(segmentsCross(a.stars[p]!, a.stars[q]!, a.stars[r]!, a.stars[t]!)).toBe(false);
        }
      const svg = renderAsterismSvg(a, id % 7 === 0 ? "Lantern over the quiet field, measured twice" : null);
      expect(SAFE_SVG.test(svg)).toBe(true);
      expect(svg).not.toMatch(/script|href|url\(|<image|<foreignObject|animate|@import/i);
      expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/https?:/);
      const bytes = new TextEncoder().encode(svg).length;
      expect(bytes).toBeLessThan(SVG_BYTE_LIMIT);
      maxBytes = Math.max(maxBytes, bytes);
      maxWords = Math.max(maxWords, a.wordsUsed);
      fallbackStars += a.fallbackStars;
      svgs.add(renderAsterismSvg(a, null));
    }
    // Reported, not asserted beyond "nearly all unique".
    console.log(
      `[report] ids=${MAX_SUPPLY_TOKENS} uniqueImages=${svgs.size} maxSvgBytes=${maxBytes} maxDrawWords=${maxWords} fallbackStars=${fallbackStars}`,
    );
    expect(svgs.size).toBeGreaterThan(MAX_SUPPLY_TOKENS - 5);
  });
});

describe("MST", () => {
  it("matches a brute-force total weight on small sets", () => {
    const s = new DrawStream(SEEDS[2]!, 1);
    for (let k = 0; k < 50; k++) {
      const pts = Array.from({ length: 6 }, () => ({ x: s.draw(400), y: s.draw(400) }));
      const edges = minimumSpanningTree(pts);
      const w = edges.reduce((acc, [i, j]) => acc + Math.sqrt(distSq(pts[i]!, pts[j]!)), 0);
      // Brute force: enumerate all spanning trees via Prüfer sequences of length n-2.
      let best = Infinity;
      const n = pts.length;
      const total = n ** (n - 2);
      for (let code = 0; code < total; code++) {
        const seq: number[] = [];
        let c = code;
        for (let i = 0; i < n - 2; i++) {
          seq.push(c % n);
          c = Math.floor(c / n);
        }
        const degree = new Array<number>(n).fill(1);
        for (const v of seq) degree[v]! += 1;
        let weight = 0;
        for (const v of seq) {
          const leaf = degree.findIndex((d) => d === 1);
          weight += Math.sqrt(distSq(pts[leaf]!, pts[v]!));
          degree[leaf]! -= 1;
          degree[v]! -= 1;
        }
        const rest = degree.map((d, i) => (d === 1 ? i : -1)).filter((i) => i >= 0);
        weight += Math.sqrt(distSq(pts[rest[0]!]!, pts[rest[1]!]!));
        best = Math.min(best, weight);
      }
      expect(Math.abs(w - best)).toBeLessThan(1e-9);
    }
  });
});

describe("names and unrevealed state", () => {
  it("rejects names outside the allowed set or length", () => {
    expect(validName("Quiet field")).toBe("Quiet field");
    expect(validName("<script>")).toBeNull();
    expect(validName('a"b')).toBeNull();
    expect(validName("&amp;")).toBeNull();
    expect(validName("x".repeat(49))).toBeNull();
    expect(validName("é")).toBeNull();
  });

  it("renders the same unrevealed image for every id", () => {
    const svg = renderUnrevealedSvg();
    expect(SAFE_SVG.test(svg)).toBe(true);
    expect(svg).not.toMatch(/ASTERISM \d/);
  });
});
