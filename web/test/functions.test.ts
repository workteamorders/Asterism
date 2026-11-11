import { describe, expect, it, vi } from "vitest";
import { encodeFunctionData, parseAbi } from "viem";
import { handleRpc } from "../functions/_lib/rpcHandler";
import { handleGeo } from "../functions/_lib/geo";
import { MULTICALL3 } from "../functions/_lib/rpcPolicy";

const LAUNCHER = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const TOKEN = "0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81";
const OTHER = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const SITE = "https://asterism.example";
const env = { RPC_UPSTREAM_URL: "https://provider.example/v2/SECRET-KEY", PROJECT_ADDRESSES: `${LAUNCHER},${TOKEN}`, MAX_LOG_RANGE: "1000" };

function req(body: unknown, headers: Record<string, string> = { origin: SITE }, method = "POST") {
  return new Request(`${SITE}/api/rpc`, { method, headers: { "content-type": "application/json", ...headers }, body: method === "POST" ? JSON.stringify(body) : undefined });
}

function upstreamOk(result: unknown = "0x1") {
  return vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
    const calls = JSON.parse(String(init?.body));
    const one = (c: { id: number }) => ({ jsonrpc: "2.0", id: c.id, result });
    return new Response(JSON.stringify(Array.isArray(calls) ? calls.map(one) : one(calls)), { status: 200 });
  });
}

const call = (method: string, params: unknown[] = [], id = 1) => ({ jsonrpc: "2.0", id, method, params });

describe("/api/rpc policy", () => {
  it("forwards allowlisted reads and never exposes the provider URL", async () => {
    const f = upstreamOk("0x1237");
    const r = await handleRpc(req(call("eth_chainId")), env, f as unknown as typeof fetch);
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain("SECRET-KEY");
    expect(f).toHaveBeenCalledOnce();
    expect(r.headers.get("access-control-allow-origin")).toBe(SITE);
  });

  it("rejects methods outside the allowlist", async () => {
    for (const m of ["eth_sendRawTransaction", "eth_sendTransaction", "eth_sign", "debug_traceTransaction", "eth_getBlockByNumber", "anvil_setBalance"]) {
      const f = upstreamOk();
      const r = await handleRpc(req(call(m)), env, f as unknown as typeof fetch);
      expect(r.status, m).toBe(403);
      expect(f).not.toHaveBeenCalled();
    }
  });

  it("only lets eth_call and eth_estimateGas target project contracts or a multicall of them", async () => {
    const ok = await handleRpc(req(call("eth_call", [{ to: LAUNCHER, data: "0x" }, "latest"])), env, upstreamOk() as unknown as typeof fetch);
    expect(ok.status).toBe(200);
    const bad = await handleRpc(req(call("eth_call", [{ to: OTHER, data: "0x" }, "latest"])), env, upstreamOk() as unknown as typeof fetch);
    expect(bad.status).toBe(403);
    const est = await handleRpc(req(call("eth_estimateGas", [{ to: OTHER, data: "0x" }])), env, upstreamOk() as unknown as typeof fetch);
    expect(est.status).toBe(403);
    const abi = parseAbi(["struct Call3 { address target; bool allowFailure; bytes callData; }", "function aggregate3(Call3[] calls) payable returns ((bool success, bytes returnData)[])"]);
    const mcGood = encodeFunctionData({ abi, functionName: "aggregate3", args: [[{ target: LAUNCHER, allowFailure: false, callData: "0x" }, { target: TOKEN, allowFailure: false, callData: "0x" }]] });
    const mcBad = encodeFunctionData({ abi, functionName: "aggregate3", args: [[{ target: LAUNCHER, allowFailure: false, callData: "0x" }, { target: OTHER, allowFailure: false, callData: "0x" }]] });
    expect((await handleRpc(req(call("eth_call", [{ to: MULTICALL3, data: mcGood }, "latest"])), env, upstreamOk() as unknown as typeof fetch)).status).toBe(200);
    expect((await handleRpc(req(call("eth_call", [{ to: MULTICALL3, data: mcBad }, "latest"])), env, upstreamOk() as unknown as typeof fetch)).status).toBe(403);
  });

  it("limits eth_getLogs to project addresses and a bounded range", async () => {
    const f = () => upstreamOk([]) as unknown as typeof fetch;
    expect((await handleRpc(req(call("eth_getLogs", [{ address: LAUNCHER, fromBlock: "0x10", toBlock: "0x3f8" }])), env, f())).status).toBe(200);
    expect((await handleRpc(req(call("eth_getLogs", [{ address: OTHER, fromBlock: "0x10", toBlock: "0x20" }])), env, f())).status).toBe(403);
    expect((await handleRpc(req(call("eth_getLogs", [{ address: LAUNCHER, fromBlock: "0x0", toBlock: "0x100000" }])), env, f())).status).toBe(413);
    expect((await handleRpc(req(call("eth_getLogs", [{ address: LAUNCHER, fromBlock: "earliest", toBlock: "latest" }])), env, f())).status).toBe(400);
    expect((await handleRpc(req(call("eth_getLogs", [{ fromBlock: "0x1", toBlock: "0x2" }])), env, f())).status).toBe(403);
  });

  it("rejects oversized batches and bodies", async () => {
    const batch = Array.from({ length: 26 }, (_, i) => call("eth_chainId", [], i));
    expect((await handleRpc(req(batch), env, upstreamOk() as unknown as typeof fetch)).status).toBe(400);
    const ok = Array.from({ length: 25 }, (_, i) => call("eth_chainId", [], i));
    expect((await handleRpc(req(ok), env, upstreamOk() as unknown as typeof fetch)).status).toBe(200);
    const huge = call("eth_call", [{ to: LAUNCHER, data: `0x${"00".repeat(70_000)}` }, "latest"]);
    expect((await handleRpc(req(huge), env, upstreamOk() as unknown as typeof fetch)).status).toBe(413);
  });

  it("rejects requests from other origins or without an origin", async () => {
    expect((await handleRpc(req(call("eth_chainId"), { origin: "https://evil.example" }), env, upstreamOk() as unknown as typeof fetch)).status).toBe(403);
    expect((await handleRpc(req(call("eth_chainId"), {}), env, upstreamOk() as unknown as typeof fetch)).status).toBe(403);
    const extra = { ...env, ALLOWED_ORIGINS: "https://preview.asterism.example" };
    expect((await handleRpc(req(call("eth_chainId"), { origin: "https://preview.asterism.example" }), extra, upstreamOk() as unknown as typeof fetch)).status).toBe(200);
  });

  it("applies the rate limiter when bound", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) };
    const r = await handleRpc(req(call("eth_chainId"), { origin: SITE, "cf-connecting-ip": "203.0.113.9" }), { ...env, RPC_LIMITER: limiter }, upstreamOk() as unknown as typeof fetch);
    expect(r.status).toBe(429);
    expect(limiter.limit).toHaveBeenCalledWith({ key: "203.0.113.9" });
  });

  it("strips provider error messages but keeps revert data", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "boom https://provider.example/v2/SECRET-KEY", data: "0xdeadbeef" } })));
    const r = await handleRpc(req(call("eth_call", [{ to: LAUNCHER, data: "0x" }, "latest"])), env, f as unknown as typeof fetch);
    const text = await r.text();
    expect(text).not.toContain("SECRET-KEY");
    expect(text).toContain("0xdeadbeef");
  });

  it("refuses to run without an upstream and answers preflight only for allowed origins", async () => {
    expect((await handleRpc(req(call("eth_chainId")), { ...env, RPC_UPSTREAM_URL: "" })).status).toBe(503);
    expect((await handleRpc(req(null, { origin: SITE }, "OPTIONS"), env)).status).toBe(204);
    expect((await handleRpc(req(null, { origin: "https://evil.example" }, "OPTIONS"), env)).status).toBe(403);
  });
});

describe("/api/geo", () => {
  it("is view-only for blocked countries using a spoofed header in tests", async () => {
    const r = handleGeo(new Request(`${SITE}/api/geo`, { headers: { "cf-ipcountry": "XX" } }), { BLOCKED_COUNTRIES: "XX, YY" });
    expect(await r.json()).toEqual({ country: "XX", viewOnly: true });
    const ok = handleGeo(new Request(`${SITE}/api/geo`, { headers: { "cf-ipcountry": "ID" } }), { BLOCKED_COUNTRIES: "XX" });
    expect(await ok.json()).toEqual({ country: "ID", viewOnly: false });
  });

  it("prefers request.cf.country over the header and defaults to allowed", async () => {
    const r = Object.assign(new Request(`${SITE}/api/geo`, { headers: { "cf-ipcountry": "XX" } }), { cf: { country: "DE" } });
    expect(await handleGeo(r, { BLOCKED_COUNTRIES: "XX" }).json()).toEqual({ country: "DE", viewOnly: false });
    expect(await handleGeo(new Request(`${SITE}/api/geo`), {}).json()).toEqual({ country: null, viewOnly: false });
  });
});
