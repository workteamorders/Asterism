import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SEED } from "@/lib/asterism/preview";
import { lensPosition, lensScene, waveProgress } from "@/components/fieldscape/lens";
import { fieldLayout, shouldAnimate } from "@/components/fieldscape/layout";
import { interpolateCount } from "@/components/meter/count";
import { contrast } from "@/lib/color";
import { formatInt } from "@/lib/format";

describe("measurement field", () => {
  it("uses deterministic, bounded coordinates and valid constellation edges", () => {
    const layout = fieldLayout(EXAMPLE_SEED, 3, 360, 780);
    expect(layout).toEqual(fieldLayout(EXAMPLE_SEED, 3, 360, 780));
    expect(layout.stars.length).toBeLessThan(fieldLayout(EXAMPLE_SEED, 6, 1280, 800).stars.length);
    expect(layout.edges).toHaveLength(layout.stars.length - 3);
    for (const star of layout.stars) {
      expect(star.x).toBeGreaterThan(0);
      expect(star.x).toBeLessThan(360);
      expect(star.y).toBeGreaterThan(0);
      expect(star.y).toBeLessThan(780);
    }
    for (const [from, to] of layout.edges) {
      expect(layout.stars[from]).toBeDefined();
      expect(layout.stars[to]).toBeDefined();
    }
  });

  it("keeps AA text contrast (4.5:1) where ambient marks overlap text", () => {
    const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
    const color = (name: string) => css.match(new RegExp(`--${name}: (#[a-f0-9]{6});`))![1]!;
    for (const text of ["text", "text-muted"]) {
      for (const layer of ["ground", "grid", "edge", "star"]) {
        expect(contrast(color(text), color(`field-${layer}`))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("sweeps through the artwork tray and loops without jumping", () => {
    const start = lensPosition(0, 7200, 400, 400, 0.75);
    const middle = lensPosition(3600, 7200, 400, 400, 0.75);
    expect(middle.x - start.x).toBeCloseTo(300);
    expect(lensPosition(7200, 7200, 400, 400, 0.75)).toEqual(start);
  });

  it("projects three reference constellations into the artwork tray", () => {
    const scene = lensScene(328, 328);
    expect(scene).toEqual(lensScene(328, 328));
    expect(scene).toHaveLength(3);
    for (const cluster of scene) {
      expect(cluster.edges).toHaveLength(cluster.stars.length - 1);
      expect(cluster.stars.filter((star) => star.primary)).toHaveLength(1);
      for (const star of cluster.stars) {
        expect(star.x).toBeGreaterThan(0);
        expect(star.x).toBeLessThan(328);
        expect(star.y).toBeGreaterThan(0);
        expect(star.y).toBeLessThan(328);
      }
    }
  });

  it("delays each diffraction wave and lets it finish independently", () => {
    expect(waveProgress(0, 1000, 0, 0.26)).toBe(0);
    expect(waveProgress(0, 1000, 1, 0.26)).toBeLessThan(0);
    expect(waveProgress(260, 1000, 1, 0.26)).toBeCloseTo(0);
    expect(waveProgress(1520, 1000, 2, 0.26)).toBeCloseTo(1);
  });

  it("only schedules motion while visible and permitted", () => {
    expect(shouldAnimate(false, false, true)).toBe(true);
    expect(shouldAnimate(true, false, true)).toBe(false);
    expect(shouldAnimate(false, true, true)).toBe(false);
    expect(shouldAnimate(false, false, false)).toBe(false);
  });
});

describe("sale counter", () => {
  it("eases in either direction and preserves the formatted endpoints", () => {
    expect(formatInt(interpolateCount(990, 1100, 0))).toBe("990");
    expect(interpolateCount(990, 1100, 0.5)).toBeGreaterThan(990);
    expect(interpolateCount(1100, 990, 0.5)).toBeLessThan(1100);
    expect(formatInt(interpolateCount(990, 1100, 1.1))).toBe("1,100");
  });
});
