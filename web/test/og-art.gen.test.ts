import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { asterismFor, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { renderAsterismSvg } from "@/lib/asterism/svg";

describe.runIf(process.env.GEN_FIXTURES === "1")("og art", () => {
  it("writes scripts/.og-art.svg", () => {
    writeFileSync(new URL("../scripts/.og-art.svg", import.meta.url), renderAsterismSvg(asterismFor(EXAMPLE_SEED, 97), null));
  });
});
