import { describe, expect, it } from "vitest";
// @ts-expect-error plain ES module without types
import { checkConfig, MAINNET } from "../../scripts/preflight.mjs";

type R = { level: string; text: string };
const NOW = 1_800_000_000;
const good = {
  name: "Asterism", symbol: "ASTERISM", mintPriceWei: "2000000000000000", walletCap: 10, txCap: 5,
  saleStart: NOW + 3 * 86400, saleEnd: NOW + 6 * 86400, finalizeWindowSeconds: 259200, revealWindowSeconds: 259200,
  treasury: "0x1111111111111111111111111111111111111111", revealCommit: `0x${"ab".repeat(32)}`,
  weth: MAINNET.weth, uniswapV2Factory: MAINNET.factory,
};
const fails = (cfg: object) => (checkConfig(cfg, NOW, 4663) as R[]).filter((r) => r.level === "FAIL").map((r) => r.text);

describe("preflight config checks", () => {
  it("accepts a sound mainnet config", () => expect(fails(good)).toEqual([]));
  it("rejects placeholders, near-term sales and wrong DEX addresses", () => {
    expect(fails({ ...good, treasury: "REPLACE_treasury" }).length).toBeGreaterThan(0);
    expect(fails({ ...good, saleStart: NOW + 1800 })).toContain("saleStart must be more than one hour after the moment you deploy");
    expect(fails({ ...good, weth: "0x2222222222222222222222222222222222222222" })).toContain("weth differs from the recorded official mainnet address");
    expect(fails({ ...good, saleEnd: good.saleStart + 60 })).toContain("saleEnd must be at least one hour after saleStart");
    expect(fails({ ...good, revealCommit: `0x${"0".repeat(64)}` })).toContain("revealCommit must be a non-zero bytes32");
    expect(fails({ ...good, mintPriceWei: "0" })).toContain("mintPriceWei is not a positive integer");
  });
  it("warns instead of failing when the start is close", () => {
    const r = checkConfig({ ...good, saleStart: NOW + 7200 }, NOW, 4663) as R[];
    expect(r.some((x) => x.level === "WARN" && x.text.includes("24 hours"))).toBe(true);
  });
});
