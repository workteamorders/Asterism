// Writes out/_headers for Cloudflare Pages: security headers for every path, plus a strict per-page
// Content-Security-Policy that allows only this page's own inline scripts by hash (no 'unsafe-inline' scripts).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeFlightScripts } from "./flight-merge.mjs";

const OUT = fileURLToPath(new URL("../out/", import.meta.url));
const EXPLORERS = ["https://robinhoodchain.blockscout.com", "https://explorer.testnet.chain.robinhood.com"];
const extraConnect = (process.env.CSP_EXTRA_CONNECT ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function hashes(html) {
  const out = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    out.add(`'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
  }
  return [...out];
}

function csp(h) {
  return [
    "default-src 'self'",
    `script-src 'self' ${h.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${[...EXPLORERS, ...extraConnect].join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const pages = walk(OUT).filter((f) => f.endsWith(".html"));
for (const p of pages) {
  const before = readFileSync(p, "utf8");
  const after = mergeFlightScripts(before);
  if (after !== before) writeFileSync(p, after);
}
const lines = [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  X-Frame-Options: DENY",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "  Cross-Origin-Opener-Policy: same-origin",
  "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
];
const notFound = pages.find((p) => relative(OUT, p) === "404.html");
if (notFound) lines.push(`  Content-Security-Policy: ${csp(hashes(readFileSync(notFound, "utf8")))}`);
lines.push("", "/_next/static/*", "  Cache-Control: public, max-age=31536000, immutable", "");
let longest = 0;
for (const p of pages) {
  const rel = relative(OUT, p).split(sep).join("/");
  if (rel === "404.html") continue;
  const route = rel === "index.html" ? "/" : `/${rel.replace(/index\.html$/, "").replace(/\.html$/, "")}`;
  const value = csp(hashes(readFileSync(p, "utf8")));
  longest = Math.max(longest, value.length);
  for (const r of new Set([route, `/${rel}`])) lines.push(r, "  ! Content-Security-Policy", `  Content-Security-Policy: ${value}`, "");
}
if (longest > 2000) {
  const msg = `a CSP header is ${longest} characters; Cloudflare's limit is 2000`;
  // Cloudflare Pages sets CF_PAGES=1 during its builds. Elsewhere (other hosts ignore _headers) this is only a warning.
  if (process.env.CF_PAGES === "1" || process.env.STRICT_CSP_LIMIT === "1") throw new Error(msg);
  console.warn(`warning: ${msg}`);
}
writeFileSync(join(OUT, "_headers"), `${lines.join("\n")}\n`);
console.log(`_headers written for ${pages.length} pages, longest CSP ${longest} chars`);
