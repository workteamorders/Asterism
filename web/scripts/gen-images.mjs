// Renders public/og.png and the app icons with the bundled fonts and the reference renderer. Run in a dev environment:
//   NODE_PATH=<global node_modules> node scripts/gen-images.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = new URL("../", import.meta.url);
const font = readFileSync(new URL("src/fonts/archivo-latin-wdth-normal.woff2", root)).toString("base64");
const mono = readFileSync(new URL("src/fonts/martian-mono-latin-wght-normal.woff2", root)).toString("base64");
const art = readFileSync(new URL("scripts/.og-art.svg", root), "utf8");

const css = `@font-face{font-family:A;src:url(data:font/woff2;base64,${font});font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:M;src:url(data:font/woff2;base64,${mono});font-weight:100 800}
*{margin:0;box-sizing:border-box}body{background:#121315;color:#ECEDEE;font-family:A}`;

const og = `<html><head><style>${css}
.w{width:1200px;height:630px;display:grid;grid-template-columns:1fr 520px;align-items:center;padding:0 64px;gap:48px}
.k{font-family:M;font-size:16px;letter-spacing:.06em;color:#9A9EA6}
h1{font-size:68px;line-height:1.02;font-weight:560;font-stretch:120%;letter-spacing:-.02em;margin:24px 0}
p{font-size:24px;line-height:1.4;color:#9A9EA6;max-width:520px}
.a{width:520px;height:520px;outline:1px solid #6A6E76}.a svg{width:100%;height:100%;display:block}
.l{font-family:M;font-size:13px;color:#9A9EA6;margin-top:12px;letter-spacing:.06em}
</style></head><body><div class="w"><div><div class="k">— ON-CHAIN ASTERISMS · ROBINHOOD CHAIN</div>
<h1>Every asterism is drawn by the contract.</h1><p>2,222 hybrid tokens. One whole token, one asterism. Fixed price, no tax, liquidity locked by code.</p></div>
<div><div class="a">${art}</div><div class="l">EXAMPLE ART · SEED NOT REVEALED</div></div></div></body></html>`;

const icon = (size) => `<html><head><style>${css}</style></head><body style="width:${size}px;height:${size}px;display:grid;place-items:center">
<svg viewBox="0 0 32 32" width="${size}" height="${size}"><rect width="32" height="32" fill="#121315"/><path d="M16 5L17.2 14.8L27 16L17.2 17.2L16 27L14.8 17.2L5 16L14.8 14.8Z" fill="#FFF4E0"/><circle cx="25" cy="7" r="1.8" fill="#B9F15A"/></svg></body></html>`;

const b = await chromium.launch();
const shot = async (html, w, h, out) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: fileURLToPath(new URL(out, root)) });
  await p.close();
};
await shot(og, 1200, 630, "public/og.png");
await shot(icon(192), 192, 192, "public/icon-192.png");
await shot(icon(512), 512, 512, "public/icon-512.png");
await shot(icon(180), 180, 180, "public/apple-touch-icon.png");
await b.close();
console.log("images written");
