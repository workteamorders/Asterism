// End-to-end test against local anvil + wrangler pages dev (static site + Pages Functions).
// Never touches a public network. Run: NODE_PATH=$(npm root -g) node test/e2e/run.mjs
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { encodeFunctionData, parseAbi } from "viem";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ANVIL = "http://127.0.0.1:8545";
const SITE = "http://127.0.0.1:8788";
const SHOTS = process.env.SHOTS ?? "/tmp/e2e-shots";
mkdirSync(SHOTS, { recursive: true });
const dep = JSON.parse(readFileSync(new URL("../../../deployments/31337.json", import.meta.url), "utf8"));
const local = JSON.parse(readFileSync(new URL("../../../deployments/local-31337.json", import.meta.url), "utf8"));
const A = dep.addresses;
const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const USER = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const OTHERS = ["0x90F79bf6EB2c4f870365E785982E1f101E93b906", "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"];

let id = 1;
async function rpc(method, params = []) {
  const r = await fetch(ANVIL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
const launcherAbi = parseAbi(["function buy(uint256)", "function reveal(bytes32)", "function saleStart() view returns (uint256)"]);
async function send(from, to, data, value = 0n) {
  const hash = await rpc("eth_sendTransaction", [{ from, to, data, value: `0x${value.toString(16)}` }]);
  for (let i = 0; i < 50; i++) {
    const rc = await rpc("eth_getTransactionReceipt", [hash]);
    if (rc) {
      if (rc.status !== "0x1") throw new Error(`tx failed ${hash}`);
      return rc;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("no receipt");
}
async function warpTo(ts) {
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  const now = Number(block.timestamp);
  if (ts > now) await rpc("evm_increaseTime", [ts - now]);
  await rpc("evm_mine");
}

async function startWrangler(extra = []) {
  const args = ["wrangler", "pages", "dev", "out-e2e", "--port", "8788", "--ip", "127.0.0.1", "--compatibility-date", "2026-11-04",
    "--binding", `RPC_UPSTREAM_URL=${ANVIL}`, "--binding", `PROJECT_ADDRESSES=${Object.values(A).join(",")}`, ...extra];
  const p = spawn("npx", args, { env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, cwd: new URL("../../", import.meta.url), stdio: ["ignore", "ignore", "ignore"], detached: true });
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const r = await fetch(`${SITE}/api/geo`);
      if (r.ok) return { kill: () => { try { process.kill(-p.pid, "SIGTERM"); } catch {} } };
    } catch {}
  }
  throw new Error("wrangler did not start");
}

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: String(e?.message ?? e).slice(0, 3000) });
    console.log(`FAIL ${name}: ${String(e?.message ?? e).slice(0, 3000)}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function shot(page, name, widths = [360, 768, 1440]) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (m.sw > m.cw) {
      const wide = await page.evaluate((cw) => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > cw + 1).slice(0, 2).map((e) => { const chain = []; for (let x = e; x && x !== document.body; x = x.parentElement) chain.push(`${x.tagName.toLowerCase()}.${String(x.className).slice(0, 24)}[${Math.round(x.getBoundingClientRect().width)},${getComputedStyle(x).display}]`); return chain.join(" < "); }), m.cw);
      throw new Error(`${name} overflows horizontally at ${w}px (${m.sw} > ${m.cw}): ${wide.join(" | ")}`);
    }
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function connect(page) {
  await page.waitForTimeout(500);
  if (await page.getByRole("button", { name: /0x3C44/i }).count()) return;
  await page.getByRole("button", { name: "Connect wallet" }).first().click();
  await page.getByRole("dialog", { name: "Connect a wallet" }).getByRole("button", { name: /Mock/i }).click();
  await page.getByRole("button", { name: /0x3C44/i }).first().waitFor({ timeout: 15_000 });
}

async function confirmTx(page, label) {
  const dlg = page.getByRole("dialog");
  try {
    await dlg.getByText("Simulation passed: ready to sign").waitFor({ timeout: 20_000 });
  } catch {
    throw new Error(`simulation did not pass; dialog says: ${(await dlg.innerText().catch(() => "(no dialog)")).replace(/\s+/g, " ").slice(0, 500)}`);
  }
  await dlg.getByRole("button", { name: label }).click();
  await dlg.getByText(/Confirmed in block/).waitFor({ timeout: 30_000 });
  await dlg.getByRole("button", { name: "Done" }).click();
}

const consoleErrors = [];
let wrangler = await startWrangler();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error" && !/favicon/.test(m.text())) consoleErrors.push(`${page.url()} :: ${m.text().slice(0, 200)}`);
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR ${page.url()} :: ${String(e).slice(0, 300)}`));

try {
  await step("home shows live status before the sale", async () => {
    await page.goto(`${SITE}/`, { waitUntil: "networkidle" });
    await page.getByText("Not started").first().waitFor({ timeout: 15_000 });
    await shot(page, "home-notstarted");
  });

  await step("launch page before start has no buy form", async () => {
    await page.goto(`${SITE}/launch/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "The sale has not started" }).waitFor({ timeout: 15_000 });
    expect((await page.getByRole("button", { name: "Review purchase" }).count()) === 0, "buy form visible before start");
    await shot(page, "launch-notstarted");
  });

  await warpTo(Number(local.saleStart) + 5);
  // Other wallets buy first, through the contract directly.
  for (const o of OTHERS) await send(o, A.launcher, encodeFunctionData({ abi: launcherAbi, functionName: "buy", args: [5n] }), 5n * 2_000_000_000_000_000n);

  await step("buy through the UI: risk notice, simulation, signature, proof", async () => {
    await page.goto(`${SITE}/launch/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Buy" }).waitFor({ timeout: 15_000 });
    await connect(page);
    await shot(page, "launch-sale");
    const field = page.getByLabel("Tokens to buy");
    await field.fill("9");
    await field.blur();
    await page.getByText("Enter a whole number from 1 to 5.").waitFor();
    await field.fill("2");
    await page.getByRole("button", { name: "Review purchase" }).click();
    const risk = page.getByRole("dialog", { name: "Before your first purchase" });
    await risk.waitFor();
    await risk.getByRole("checkbox").check();
    await risk.getByRole("button", { name: "I understand, continue" }).click();
    const review = page.getByRole("dialog", { name: "Review purchase" });
    await review.getByText("0.004 ETH").first().waitFor();
    await page.screenshot({ path: `${SHOTS}/launch-review-1440.png` });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: `${SHOTS}/launch-review-360.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await confirmTx(page, "Buy 2 tokens");
    await page.getByText("2 of 10 tokens").waitFor({ timeout: 20_000 });
  });

  await step("keyboard only: skip link and focus ring", async () => {
    await page.goto(`${SITE}/launch/`, { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    const skip = await page.evaluate(() => document.activeElement?.textContent);
    expect(skip?.includes("Skip to main content"), `first tab stop is ${skip}`);
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    expect(outline !== "none", "focus ring missing");
    await page.keyboard.press("Enter");
    const focusedMain = await page.evaluate(() => document.activeElement?.id === "main" || location.hash === "#main");
    expect(focusedMain, "skip link did not move to main");
  });

  // Snapshot before finalization to test the refund path, then come back.
  await warpTo((await rpc("eth_getBlockByNumber", ["latest", false])).timestamp * 1 + 86400 + 60);
  const snap = await rpc("evm_snapshot");

  await step("refund path when finalization is missed", async () => {
    await warpTo(Number(local.saleStart) + 60 + 86400 * 2 + 120);
    await page.goto(`${SITE}/launch/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Refunds are open" }).waitFor({ timeout: 15_000 });
    await shot(page, "launch-refunding");
    await page.getByRole("button", { name: "Review refund" }).click();
    await confirmTx(page, "Refund purchase");
    await page.getByText("This wallet has nothing to refund.").waitFor({ timeout: 20_000 });
  });
  await rpc("evm_revert", [snap]);
  await rpc("evm_mine");

  await step("finalize through the UI", async () => {
    await page.goto(`${SITE}/launch/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Ready to finalize" }).waitFor({ timeout: 15_000 });
    await shot(page, "launch-awaiting");
    await page.getByRole("button", { name: "Review finalization" }).click();
    await confirmTx(page, "Finalize launch");
    await page.getByRole("heading", { name: "Trading is open" }).waitFor({ timeout: 20_000 });
  });

  await step("gallery before the reveal shows unrevealed asterisms", async () => {
    await page.goto(`${SITE}/gallery/`, { waitUntil: "networkidle" });
    await page.getByText("Not yet revealed").first().waitFor({ timeout: 15_000 });
    await page.getByText(/17 of 17 asterisms/).waitFor({ timeout: 20_000 });
  });

  // The revealer (deployer) reveals with the local test secret, outside the site.
  await step("revealer reveals the seed (outside the site)", async () => {
    await send(DEPLOYER, A.launcher, encodeFunctionData({ abi: launcherAbi, functionName: "reveal", args: [local.testSecret] }));
  });

  await step("treasury share can be sent by anyone from the UI", async () => {
    await page.goto(`${SITE}/launch/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Send treasury share" }).click();
    await confirmTx(page, "Send treasury share");
    await page.getByText("Yes").first().waitFor({ timeout: 20_000 });
    await shot(page, "launch-trading");
  });

  await step("gallery after reveal: filters, detail and on-chain match", async () => {
    await page.goto(`${SITE}/gallery/`, { waitUntil: "networkidle" });
    await page.getByText(/17 of 17 asterisms/).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await shot(page, "gallery");
    await page.getByRole("button", { name: "Named only" }).click();
    await page.getByText("Nothing matches these filters").waitFor();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.goto(`${SITE}/gallery/?id=1`, { waitUntil: "networkidle" });
    await page.getByText("The on-chain image matches the reference renderer byte for byte.").waitFor({ timeout: 20_000 });
    await shot(page, "gallery-detail");
  });

  await step("observatory: name with preview, then send", async () => {
    await page.goto(`${SITE}/observatory/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Asterism #/ }).waitFor({ timeout: 20_000 });
    await shot(page, "observatory");
    const nameField = page.getByRole("textbox", { name: "Name", exact: true });
    await nameField.fill("<script>");
    await nameField.blur();
    await page.getByText("Use letters, numbers, spaces and . , ! ? ' - only.").waitFor();
    await nameField.fill("Quiet field");
    await page.getByRole("button", { name: "Preview on the art" }).click();
    await page.getByRole("img", { name: /with the name Quiet field/ }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Review name" }).click();
    await confirmTx(page, "Save name");
    await page.goto(`${SITE}/gallery/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Named only" }).click();
    await page.getByText(/1 of 17 asterisms/).waitFor({ timeout: 20_000 });
    await page.goto(`${SITE}/observatory/`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Send" }).click();
    await page.getByLabel("Recipient address").fill(OTHERS[0]);
    await page.getByRole("button", { name: "Review send" }).click();
    await confirmTx(page, /Send asterism #/);
    await page.getByText("Asterisms in this wallet").waitFor();
  });

  await step("fraction check warns before a partial transfer", async () => {
    await page.goto(`${SITE}/observatory/`, { waitUntil: "networkidle" });
    await page.getByLabel("Amount you plan to send").fill("0.5");
    await page.getByText(/1 asterism would leave this wallet/).waitFor({ timeout: 10_000 });
  });

  await step("rules: verify the reveal locally", async () => {
    await page.goto(`${SITE}/rules/`, { waitUntil: "networkidle" });
    await page.getByLabel("Published secret").fill(local.testSecret);
    await page.getByRole("button", { name: "Check the secret" }).click();
    await page.getByText("The secret matches the commitment").waitFor({ timeout: 10_000 });
    await page.getByText("The on-chain seed equals keccak256(secret, entropy).", { exact: false }).waitFor();
    await shot(page, "rules");
  });

  await step("contracts: code matches this build for all five", async () => {
    await page.goto(`${SITE}/contracts/`, { waitUntil: "networkidle" });
    const badge = page.getByText("Code matches this build", { exact: true });
    for (let i = 0; i < 60 && (await badge.count()) < 5; i++) await page.waitForTimeout(500);
    expect((await badge.count()) === 5, `matching badges: ${await badge.count()}`);
    expect((await page.getByText("Code differs from this build").count()) === 0, "a contract differs");
    expect((await page.getByText("Differs from published").count()) === 0, "a constant differs");
    expect((await page.getByText("No external audit yet").count()) === 1, "audit status missing");
    await shot(page, "contracts");
  });

  for (const [path, name] of [["/", "home-trading"], ["/risk/", "risk"], ["/terms/", "terms"], ["/does-not-exist/", "404"], ["/offline/", "offline"]]) {
    await step(`screens ${name}`, async () => {
      await page.goto(`${SITE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      await shot(page, name);
    });
  }

  await step("geoblock: view-only mode hides buy, name and send", async () => {
    wrangler.kill();
    await new Promise((r) => setTimeout(r, 1500));
    // wrangler pages dev reports a placeholder request.cf.country of "US"; block it to exercise the real function.
    wrangler = await startWrangler(["--binding", "BLOCKED_COUNTRIES=US"]);
    const geo = await (await fetch(`${SITE}/api/geo`)).json();
    expect(geo.viewOnly === true, `geo said ${JSON.stringify(geo)}`);
    await page.goto(`${SITE}/observatory/`, { waitUntil: "networkidle" });
    await page.getByText("View only in your region").first().waitFor({ timeout: 15_000 });
    expect((await page.getByRole("button", { name: "Review name" }).count()) === 0, "name form visible");
    expect((await page.getByRole("button", { name: "Review send" }).count()) === 0, "send form visible");
    await page.goto(`${SITE}/launch/`, { waitUntil: "networkidle" });
    await page.getByText("View only in your region").first().waitFor({ timeout: 15_000 });
    expect((await page.getByRole("button", { name: /Review (purchase|finalization|refund)|Send treasury/ }).count()) === 0, "action visible in view-only");
    await shot(page, "launch-viewonly", [360, 1440]);
  });
} finally {
  await browser.close();
  wrangler.kill();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed`);
if (consoleErrors.length) console.log(`console errors:\n${[...new Set(consoleErrors)].slice(0, 20).join("\n")}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
