export interface GeoEnv {
  /** Comma-separated ISO 3166-1 alpha-2 codes. Decided by the owner with legal counsel. Empty by default. */
  BLOCKED_COUNTRIES?: string;
}

/**
 * Country comes from Cloudflare's request.cf.country in production. The CF-IPCountry header is only read when
 * request.cf is missing (local development and tests); on Cloudflare the edge sets that header itself.
 */
export function handleGeo(req: Request & { cf?: { country?: string } }, env: GeoEnv): Response {
  const fromCf = req.cf?.country;
  const country = (fromCf ?? req.headers.get("cf-ipcountry") ?? "").toUpperCase() || null;
  return geoResponse(country, env, "cf-ipcountry");
}

/** Shared by every host. `country` must already come from a header or field the platform itself sets. */
export function geoResponse(country: string | null, env: GeoEnv, varyHeader: string): Response {
  if (country !== null && !/^[A-Z]{2}$/.test(country)) country = null;
  const blocked = new Set(
    (env.BLOCKED_COUNTRIES ?? "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c)),
  );
  const viewOnly = country !== null && blocked.has(country);
  return new Response(JSON.stringify({ country, viewOnly }), {
    headers: { "content-type": "application/json", "cache-control": "private, no-store", vary: varyHeader },
  });
}
