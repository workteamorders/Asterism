import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error plain ES module without types
import { injectCspMeta } from "../scripts/csp-meta.mjs";
import { selfUrl } from "../functions/_lib/vercel";
import geo from "../api/geo";
import rpc from "../api/rpc";

const SITE = "https://asterism.example";
const call = { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("api/geo (Vercel)", () => {
  it("reads only x-vercel-ip-country and marks listed countries view-only", async () => {
    vi.stubEnv("BLOCKED_COUNTRIES", "xx, YY");
    const r = await geo.fetch(new Request(`${SITE}/api/geo`, { headers: { "x-vercel-ip-country": "xx" } }));
    expect(await r.json()).toEqual({ country: "XX", viewOnly: true });
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("ignores Cloudflare's header and unlisted countries", async () => {
    vi.stubEnv("BLOCKED_COUNTRIES", "XX");
    const spoof = await geo.fetch(new Request(`${SITE}/api/geo`, { headers: { "cf-ipcountry": "XX" } }));
    expect(await spoof.json()).toEqual({ country: null, viewOnly: false });
    const other = await geo.fetch(new Request(`${SITE}/api/geo`, { headers: { "x-vercel-ip-country": "ZZ" } }));
    expect(await other.json()).toEqual({ country: "ZZ", viewOnly: false });
  });

  it("rejects a malformed country value and non-GET methods", async () => {
    vi.stubEnv("BLOCKED_COUNTRIES", "XX");
    const bad = await geo.fetch(new Request(`${SITE}/api/geo`, { headers: { "x-vercel-ip-country": "<script>" } }));
    expect(await bad.json()).toEqual({ country: null, viewOnly: false });
    expect((await geo.fetch(new Request(`${SITE}/api/geo`, { method: "POST" }))).status).toBe(405);
  });
});

describe("selfUrl", () => {
  it("builds the site URL from the host headers", () => {
    const r = new Request("http://internal/api/rpc", { headers: { host: "asterism.example", "x-forwarded-proto": "https" } });
    expect(selfUrl(r)).toBe("https://asterism.example/");
  });
  it("falls back to request.url on a malformed host", () => {
    const r = new Request("http://internal/api/rpc", { headers: { "x-forwarded-host": "a b/c" } });
    expect(selfUrl(r)).toBe("http://internal/api/rpc");
  });
});

describe("api/rpc (Vercel)", () => {
  const upstream = () =>
    vi.fn(async (_u: unknown, init?: RequestInit) => new Response(JSON.stringify({ jsonrpc: "2.0", id: JSON.parse(String(init?.body)).id, result: "0x1237" })));
  const post = (headers: Record<string, string>) =>
    new Request("http://internal/api/rpc", { method: "POST", headers: { "content-type": "application/json", host: "asterism.example", "x-forwarded-proto": "https", ...headers }, body: JSON.stringify(call) });

  it("accepts the site's own origin (from host headers) and forwards using process.env", async () => {
    vi.stubEnv("RPC_UPSTREAM_URL", "https://provider.example/SECRET-KEY");
    const f = upstream();
    vi.stubGlobal("fetch", f);
    const r = await rpc.fetch(post({ origin: SITE }));
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain("SECRET-KEY");
    expect(f).toHaveBeenCalledOnce();
  });

  it("refuses a foreign origin and a missing upstream", async () => {
    vi.stubEnv("RPC_UPSTREAM_URL", "https://provider.example/k");
    const f = upstream();
    vi.stubGlobal("fetch", f);
    expect((await rpc.fetch(post({ origin: "https://evil.example" }))).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
    vi.stubEnv("RPC_UPSTREAM_URL", "");
    expect((await rpc.fetch(post({ origin: SITE }))).status).toBe(503);
  });
});

describe("injectCspMeta", () => {
  const policy = "default-src 'self'; script-src 'self' 'sha256-abc='; frame-ancestors 'none'; object-src 'none'";
  it("places the policy right after the charset and drops frame-ancestors", () => {
    const html = '<html><head><meta charSet="utf-8"/><meta name="viewport" content="x"/><script src="/a.js"></script></head></html>';
    const out = injectCspMeta(html, policy) as string;
    expect(out.indexOf("Content-Security-Policy")).toBeGreaterThan(out.indexOf('charSet="utf-8"'));
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<script"));
    expect(out).toContain("object-src 'none'");
    expect(out).not.toContain("frame-ancestors");
  });
  it("is idempotent and falls back to the head tag", () => {
    const once = injectCspMeta("<html><head></head></html>", policy) as string;
    expect(once).toContain("<head><meta http-equiv");
    expect(injectCspMeta(once, policy)).toBe(once);
  });
});
