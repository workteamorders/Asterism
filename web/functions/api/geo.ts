import { handleGeo, type GeoEnv } from "../_lib/geo";

interface Ctx {
  request: Request & { cf?: { country?: string } };
  env: GeoEnv;
}

export const onRequestGet = (ctx: Ctx): Response => handleGeo(ctx.request, ctx.env);
