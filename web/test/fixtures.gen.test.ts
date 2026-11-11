// Writes golden fixtures for the Solidity renderer. Run with: GEN_FIXTURES=1 pnpm exec vitest run test/fixtures.gen.test.ts
import { describe, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { keccak256, toHex, toBytes } from "viem";
import { buildAsterism } from "@/lib/asterism/geometry";
import { renderAsterismSvg, renderUnrevealedSvg } from "@/lib/asterism/svg";
import { tokenUri, unrevealedUri } from "@/lib/asterism/metadata";
import { MAX_SUPPLY_TOKENS } from "@/lib/asterism/spec";

const OUT = new URL("../../contracts/test/fixtures/", import.meta.url);
const SEED = keccak256(toHex("asterism-styleguide-example"));
const NAMES = ["", "Lantern over the quiet field", "Forty-eight bytes of name, measured twice! Ok?.."];

describe.runIf(process.env.GEN_FIXTURES === "1")("generate fixtures", () => {
  it("writes golden.json, svg-hashes.bin and tiers.bin", () => {
    mkdirSync(OUT, { recursive: true });
    const all = Array.from({ length: MAX_SUPPLY_TOKENS }, (_, i) => buildAsterism(SEED, i + 1));
    const picks: number[] = [];
    for (let t = 0; t < 5; t++) for (const g of [0, 1, 2]) {
      const a = all.find((x) => x.tier === t && x.guide === g && !picks.includes(x.id));
      if (a) picks.push(a.id);
    }
    picks.push(1, 1000, 2222);
    const cases = picks.flatMap((id, k) => {
      const a = all[id - 1]!;
      const name = NAMES[k % NAMES.length]!;
      return [{ id, name, svg: renderAsterismSvg(a, name), uri: tokenUri(a, name) }];
    });
    const golden = {
      seed: SEED,
      maxSupply: MAX_SUPPLY_TOKENS,
      unrevealedSvg: renderUnrevealedSvg(),
      unrevealedUri7: unrevealedUri(7),
      count: cases.length,
      cases,
    };
    writeFileSync(new URL("golden.json", OUT), JSON.stringify(golden, null, 1));
    const hashes = Buffer.concat(all.map((a) => Buffer.from(toBytes(keccak256(toHex(renderAsterismSvg(a, null)))))));
    writeFileSync(new URL("svg-hashes.bin", OUT), hashes);
    writeFileSync(new URL("tiers.bin", OUT), Buffer.from(all.map((a) => a.tier)));
    if (NAMES[2]!.length !== 48) throw new Error("long name must be exactly 48 bytes");
  });
});
