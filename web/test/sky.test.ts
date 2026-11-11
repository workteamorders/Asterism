import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ghostPoint, GRID_PITCH, pullOffset, stepSpring, waveBand } from "../src/components/home/sky";

describe("observatory sky", () => {
  it("pulls a star toward the pointer, never past the cap, and not at all outside the radius", () => {
    const base = { x: 100, y: 100 };
    const near = pullOffset(base, { x: 160, y: 100 }, 200, 0.3, 18);
    expect(near.x).toBeGreaterThan(0);
    expect(near.y).toBe(0);
    expect(Math.hypot(near.x, near.y)).toBeLessThanOrEqual(18);
    expect(pullOffset(base, { x: 100 + 300, y: 100 }, 200, 0.3, 18)).toEqual({ x: 0, y: 0 });
    expect(pullOffset(base, null, 200, 0.3, 18)).toEqual({ x: 0, y: 0 });
    const strong = pullOffset(base, { x: 101, y: 100 }, 200, 50, 5);
    expect(Math.hypot(strong.x, strong.y)).toBeCloseTo(5);
  });

  it("settles a spring on its target and overshoots a little on the way (elastic, not stiff)", () => {
    const s = { x: 0, y: 0, vx: 0, vy: 0 };
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      stepSpring(s, 10, -4, 1 / 60, 90, 12);
      peak = Math.max(peak, s.x);
    }
    expect(s.x).toBeCloseTo(10, 2);
    expect(s.y).toBeCloseTo(-4, 2);
    expect(peak).toBeGreaterThan(10);
    expect(peak).toBeLessThan(13);
  });

  it("peaks a wave on its ring and fades to nothing one width away", () => {
    expect(waveBand(100, 100, 50)).toBeCloseTo(1);
    expect(waveBand(125, 100, 50)).toBeCloseTo(0.5);
    expect(waveBand(150, 100, 50)).toBe(0);
    expect(waveBand(10, 100, 50)).toBe(0);
  });

  it("keeps the ghost pointer inside the field and looping", () => {
    for (let t = 0; t < 28000; t += 700) {
      const p = ghostPoint(t, 1000, 600, 28000);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1000);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(600);
    }
    const a = ghostPoint(0, 1000, 600, 28000);
    const b = ghostPoint(28000, 1000, 600, 28000);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y).toBeCloseTo(a.y);
  });

  it("reads only tokens that exist, and draws the grid at the pitch the SVG pattern uses", () => {
    const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
    const code = readFileSync(new URL("../src/components/home/sky.ts", import.meta.url), "utf8");
    for (const [, name] of code.matchAll(/number\("([a-z-]+)"\)/g)) expect(tokens, name).toContain(`--${name}:`);
    for (const [, name] of code.matchAll(/token\("([a-z-]+)"\)/g)) expect(tokens, name).toContain(`--${name}:`);
    const map = readFileSync(new URL("../src/components/home/StarMap.tsx", import.meta.url), "utf8");
    expect(map).toContain("width={GRID_PITCH}");
    expect(GRID_PITCH).toBe(32);
    expect(map).toContain('from "./grid"');
  });
});
