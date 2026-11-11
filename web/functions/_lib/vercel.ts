/**
 * The URL this site is served from, as the visitor typed it. On Vercel the `host` header carries the production
 * domain or preview URL (docs: Request headers > host), and x-forwarded-proto the scheme. request.url is not
 * relied on because its host depends on how the platform builds the Request.
 */
export function selfUrl(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim();
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host) && (proto === "https" || proto === "http")) return `${proto}://${host}/`;
  return req.url;
}
