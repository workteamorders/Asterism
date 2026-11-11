// Vercel Function: read-only JSON-RPC proxy. The policy lives in functions/_lib (shared with the Cloudflare build).
import { handleRpc } from "../functions/_lib/rpcHandler";
import { selfUrl } from "../functions/_lib/vercel";

export const config = { runtime: "nodejs", maxDuration: 15 };

const handler = {
  fetch(request: Request): Promise<Response> {
    const env = {
      RPC_UPSTREAM_URL: process.env.RPC_UPSTREAM_URL,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      PROJECT_ADDRESSES: process.env.PROJECT_ADDRESSES,
      MAX_LOG_RANGE: process.env.MAX_LOG_RANGE,
    };
    return handleRpc(request, env, fetch, selfUrl(request));
  },
};

export default handler;
