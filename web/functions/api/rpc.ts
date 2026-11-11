import { handleRpc, type RpcEnv } from "../_lib/rpcHandler";

interface Ctx {
  request: Request;
  env: RpcEnv;
}

export const onRequest = (ctx: Ctx): Promise<Response> => handleRpc(ctx.request, ctx.env);
