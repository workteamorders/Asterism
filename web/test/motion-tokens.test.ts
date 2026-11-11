import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("stage motion", () => {
  it("takes every design value in the motion styles from tokens", () => {
    const tokens = read("../src/styles/tokens.css");
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));
    // Per-element inputs set inline by components, not tokens.
    const inline = new Set(["--rise-order", "--hero-order", "--word-order", "--star-order", "--reveal-order", "--pointer-x", "--pointer-y"]);
    for (const file of ["../src/components/motion/motion.module.css", "../src/styles/base.css"]) {
      for (const [, name] of read(file).matchAll(/var\((--[a-z0-9-]+)/g)) {
        expect(defined.has(name!) || inline.has(name!), `${name} in ${file}`).toBe(true);
      }
    }
  });

  it("never hides content unless the Rise script has run and motion is allowed", () => {
    const base = read("../src/styles/base.css");
    const hidden = base.indexOf('[data-rise="wait"]');
    expect(hidden).toBeGreaterThan(-1);
    expect(base.slice(base.lastIndexOf("@media", hidden), hidden)).toContain("prefers-reduced-motion: no-preference");
    expect(read("../src/components/motion/Rise.tsx")).toContain("prefers-reduced-motion: no-preference");
  });
});
