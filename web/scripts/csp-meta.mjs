// For hosts that cannot take a per-page Content-Security-Policy header from a build-time file (Vercel reads
// vercel.json before the build and ignores _headers), the same policy is written into the page as a meta tag.
// Limits of the meta form: it cannot carry frame-ancestors (vercel.json sends X-Frame-Options: DENY instead) and it
// only governs content that comes after it, so it is placed straight after the charset declaration.
export function injectCspMeta(html, policy) {
  if (/<meta[^>]+http-equiv=["']?content-security-policy/i.test(html)) return html;
  const content = policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith("frame-ancestors"))
    .join("; ");
  const tag = `<meta http-equiv="Content-Security-Policy" content="${content.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"/>`;
  const charset = html.match(/<meta\s+charset=[^>]*>/i);
  if (charset && charset.index !== undefined) {
    const at = charset.index + charset[0].length;
    return html.slice(0, at) + tag + html.slice(at);
  }
  const head = html.match(/<head[^>]*>/i);
  if (!head || head.index === undefined) throw new Error("no <head> to place the CSP meta tag in");
  const at = head.index + head[0].length;
  return html.slice(0, at) + tag + html.slice(at);
}
