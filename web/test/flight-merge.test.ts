import { describe, expect, it } from "vitest";
// @ts-expect-error plain ES module without types
import { mergeFlightScripts } from "../scripts/flight-merge.mjs";

const wrap = (parts: string[]) =>
  `<html><body><script>(self.__next_f=self.__next_f||[]).push([0])</script>${parts.map((p) => `<script>${p}</script>`).join("<div>x</div>")}</body></html>`;

describe("mergeFlightScripts", () => {
  it("merges many flight scripts into one, in order, and keeps the init script", () => {
    const parts = Array.from({ length: 60 }, (_, i) => `self.__next_f.push([1,"chunk ${i}"])`);
    const out = mergeFlightScripts(wrap(parts)) as string;
    const scripts = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] as string);
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toBe("(self.__next_f=self.__next_f||[]).push([0])");
    // Executing the merged script gives the same array as executing the originals.
    const run = (src: string[]) => {
      const self: { __next_f?: unknown[] } = {};
      new Function("self", src.join(";"))(self);
      return self.__next_f;
    };
    expect(run(scripts)).toEqual(run(["(self.__next_f=self.__next_f||[]).push([0])", ...parts]));
  });

  it("leaves a page with a single flight script untouched", () => {
    const html = wrap([`self.__next_f.push([1,"only"])`]);
    expect(mergeFlightScripts(html)).toBe(html);
  });

  it("does not touch other inline scripts", () => {
    const html = `<script>$RC("a","b")</script><script>self.__next_f.push([1,"a"])</script><script>self.__next_f.push([1,"b"])</script>`;
    const out = mergeFlightScripts(html) as string;
    expect(out.startsWith(`<script>$RC("a","b")</script>`)).toBe(true);
    expect((out.match(/<script>/g) ?? []).length).toBe(2);
  });
});
