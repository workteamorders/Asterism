import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contrast } from "@/lib/color";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m?.[1]) throw new Error(`token --${name} not found`);
  return m[1];
};

// [foreground, background, minimum ratio]. 4.5 for text, 3 for component boundaries and large text.
const PAIRS: [string, string, number][] = [
  ["text", "surface", 4.5],
  ["text", "surface-raised", 4.5],
  ["text", "surface-floating", 4.5],
  ["text", "surface-hover", 4.5],
  ["text", "surface-sunken", 4.5],
  ["text-muted", "surface", 4.5],
  ["text-muted", "surface-raised", 4.5],
  ["text-muted", "surface-floating", 4.5],
  ["text-muted", "surface-sunken", 4.5],
  ["on-accent", "accent", 4.5],
  ["on-accent", "accent-hover", 4.5],
  ["on-accent", "accent-pressed", 4.5],
  ["accent", "surface", 3],
  ["accent", "surface-raised", 3],
  ["line-strong", "surface", 3],
  ["line-strong", "surface-raised", 3],
  ["line-strong", "surface-sunken", 3],
  ["success", "surface", 4.5],
  ["warning", "surface", 4.5],
  ["danger", "surface", 4.5],
  ["info", "surface", 4.5],
  ["success", "success-tint", 4.5],
  ["warning", "warning-tint", 4.5],
  ["danger", "danger-tint", 4.5],
  ["info", "info-tint", 4.5],
  ["text", "success-tint", 4.5],
  ["text", "warning-tint", 4.5],
  ["text", "danger-tint", 4.5],
  ["text", "info-tint", 4.5],
  ["text-muted", "success-tint", 4.5],
  ["text-muted", "warning-tint", 4.5],
  ["text-muted", "danger-tint", 4.5],
  ["text-muted", "info-tint", 4.5],
  ["danger", "surface-hover", 4.5],
  ["starlight", "art-ground", 4.5],
];

describe("token contrast (WCAG 2.2 AA)", () => {
  for (const [fg, bg, min] of PAIRS) {
    it(`--${fg} on --${bg} >= ${min}:1`, () => {
      const r = contrast(token(fg), token(bg));
      expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
    });
  }
});
