import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SEED } from "@/lib/asterism/preview";
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

  it("preserves the base surface contrast even where marks overlap", () => {
    const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
    const color = (name: string) => css.match(new RegExp(`--${name}: (#[a-f0-9]{6});`))![1]!;
    for (const text of ["text", "text-muted"]) {
      for (const layer of ["ground", "grid", "edge", "star", "ring"]) {
        expect(contrast(color(text), color(`field-${layer}`))).toBeGreaterThanOrEqual(contrast(color(text), color("surface")));
      }
    }
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
