import { checkBatch, DEFAULT_MAX_LOG_RANGE, MAX_BODY_BYTES, parseAddresses, parseOrigins } from "./rpcPolicy";

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RpcEnv {
  /** Secret. The provider URL, including its key. Never sent to the browser. */
  RPC_UPSTREAM_URL?: string;
  ALLOWED_ORIGINS?: string;
  PROJECT_ADDRESSES?: string;
  MAX_LOG_RANGE?: string;
  /** Optional Workers Rate Limiting binding. When absent, limits fall back to the checks below and the provider's own budget. */
  RPC_LIMITER?: RateLimiter;
}

const TIMEOUT_MS = 10_000;
const CACHEABLE = new Set(["eth_chainId", "eth_getCode"]);

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
}

const rpcError = (status: number, message: string, cors: Record<string, string>) =>
  json(status, { jsonrpc: "2.0", id: null, error: { code: -32000, message } }, cors);

async function readLimited(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  const reader = req.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/** Provider errors can contain URLs with credentials; only the code survives. */
function sanitize(v: unknown): unknown {
  if (!v || typeof v !== "object") throw new Error("bad upstream");
  const r = v as { jsonrpc?: unknown; id?: unknown; result?: unknown; error?: { code?: unknown; data?: unknown } };
  if (r.jsonrpc !== "2.0" || !("result" in r || "error" in r)) throw new Error("bad upstream");
  if (!r.error) return r;
  // Keep revert data so the site can decode contract errors (it is ABI data, not provider text).
  const data = typeof r.error.data === "string" && /^0x[0-9a-fA-F]*$/.test(r.error.data) ? r.error.data : undefined;
  return { jsonrpc: "2.0", id: r.id ?? null, error: { code: typeof r.error.code === "number" ? r.error.code : -32000, message: data ? "execution reverted" : "The RPC provider rejected the request.", ...(data ? { data } : {}) } };
}

/** `siteUrl` is the URL the visitor reached this site at; hosts whose request.url is not that pass it explicitly. */
export async function handleRpc(req: Request, env: RpcEnv, fetchImpl: typeof fetch = fetch, siteUrl: string = req.url): Promise<Response> {
  const origins = parseOrigins(env.ALLOWED_ORIGINS, siteUrl);
  const origin = req.headers.get("origin");
  const cors: Record<string, string> = origin && origins.has(origin) ? { "access-control-allow-origin": origin, vary: "origin" } : {};
  if (req.method === "OPTIONS") {
    if (!cors["access-control-allow-origin"]) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type", "access-control-max-age": "600" } });
  }
  if (req.method !== "POST") return rpcError(405, "Use POST.", cors);
  if (!origin || !origins.has(origin)) return rpcError(403, "Forbidden origin.", {});

  if (env.RPC_LIMITER) {
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.RPC_LIMITER.limit({ key: ip });
    if (!success) return rpcError(429, "Too many requests. Wait a moment.", cors);
  }

  const text = await readLimited(req);
  if (text === null) return rpcError(413, "Request too large.", cors);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return rpcError(400, "Invalid JSON.", cors);
  }
  const verdict = checkBatch(body, {
    projectAddresses: parseAddresses(env.PROJECT_ADDRESSES),
    maxLogRange: Number(env.MAX_LOG_RANGE) > 0 ? Number(env.MAX_LOG_RANGE) : DEFAULT_MAX_LOG_RANGE,
  });
  if ("ok" in verdict) return rpcError(verdict.ok ? 500 : verdict.status, verdict.ok ? "Unexpected policy result." : verdict.message, cors);

  const upstream = env.RPC_UPSTREAM_URL?.trim();
  if (!upstream) return rpcError(503, "RPC is not configured.", cors);
  let url: URL;
  try {
    url = new URL(upstream);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch {
    return rpcError(500, "Invalid RPC configuration.", cors);
  }

  try {
    const r = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
      // Workers only support "follow" and "manual"; a redirect from the provider is treated as a failure below.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok || r.status >= 300) {
      await r.body?.cancel().catch(() => {});
      return rpcError(r.status === 429 ? 429 : 502, "The RPC provider rejected the request.", cors);
    }
    const data = (await r.json()) as unknown;
    const safe = Array.isArray(data) ? data.map(sanitize) : sanitize(data);
    const cacheable = verdict.calls.every((c) => CACHEABLE.has(c.method));
    return json(200, safe, { ...cors, "cache-control": cacheable ? "public, max-age=60" : "no-store" });
  } catch {
    return rpcError(502, "The RPC provider did not answer.", cors);
  }
}
