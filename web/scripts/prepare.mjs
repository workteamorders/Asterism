// Copies ../deployments/<NEXT_PUBLIC_CHAIN_ID>.json to src/generated/deployment.json before every build.
// A missing file or empty addresses means "not deployed", and the site says so.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "4663");
const src = new URL(`../../deployments/${chainId}.json`, import.meta.url);
const dst = new URL("../src/generated/deployment.json", import.meta.url);
mkdirSync(new URL("../src/generated/", import.meta.url), { recursive: true });
let data = { chainId, network: "", explorer: "", deployedAtBlock: 0, addresses: null, params: null, auditReportUrl: "" };
if (existsSync(src)) {
  const parsed = JSON.parse(readFileSync(src, "utf8"));
  if (parsed.chainId !== chainId) throw new Error(`deployments/${chainId}.json has chainId ${parsed.chainId}`);
  const a = parsed.addresses ?? {};
  const complete = ["renderer", "launcher", "token", "mirror", "sink"].every((k) => /^0x[0-9a-fA-F]{40}$/.test(a[k] ?? ""));
  data = { ...parsed, addresses: complete ? a : null };
}
writeFileSync(dst, `${JSON.stringify(data, null, 2)}\n`);
console.log(`deployment for chain ${chainId}: ${data.addresses ? "deployed" : "not deployed"}`);
