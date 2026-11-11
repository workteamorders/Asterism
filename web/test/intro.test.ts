import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTRO_BOOT, SEEN } from "../src/components/intro/boot";

function run(opts: { path?: string; seen?: boolean; reduced?: boolean; storageThrows?: boolean }) {
  const attrs: Record<string, string> = {};
  const doc = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  const storage = {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new Error("blocked");
      return k === SEEN && opts.seen ? "1" : null;
    },
  };
  new Function("document", "location", "sessionStorage", "matchMedia", INTRO_BOOT)(
    doc,
    { pathname: opts.path ?? "/" },
    storage,
    () => ({ matches: Boolean(opts.reduced) }),
  );
  return attrs["data-intro"];
}

describe("opening animation gate", () => {
  it("plays on the first visit to the home page only", () => {
    expect(run({})).toBe("on");
    expect(run({ seen: true })).toBe("off");
    expect(run({ path: "/launch/" })).toBe("off");
    expect(run({ path: "/gallery/" })).toBe("off");
  });
  it("never plays under reduced motion or when storage is unavailable", () => {
    expect(run({ reduced: true })).toBe("off");
    expect(run({ storageThrows: true })).toBe("off");
  });
  it("keeps the end time as a plain number so a minifier cannot turn 2800ms into 2.8s", () => {
    const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
    expect(tokens).toMatch(/--intro-end: \d+;/);
  });
});
