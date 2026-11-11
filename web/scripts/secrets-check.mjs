// pnpm secrets:check — fails if the repository or the built site contains anything that looks like a secret:
// private keys, seed phrases, provider API keys inside RPC URLs, tokens, or .env files with values.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO = join(ROOT, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".wrangler", "cache", "out-e2e", "broadcast"]);
const SKIP_PATHS = [join(REPO, "contracts", "lib"), join(REPO, "contracts", "out")];
// The anvil default test accounts' private keys are public knowledge; they may not appear in this repo either.
const FILE_EXT = /\.(ts|tsx|js|mjs|cjs|json|md|html|css|sol|sh|toml|txt|yml|yaml|svg|webmanifest)$/;

const RULES = [
  ["private key (64 hex after a key-like name)", /(private[_-]?key|priv[_-]?key|secret[_-]?key|mnemonic|seed[_-]?phrase)\s*["']?\s*[:=]\s*["']?(0x)?[0-9a-fA-F]{64}\b/i],
  ["bare 0x + 64 hex assigned to a PRIVATE_KEY variable", /PRIVATE_KEY\s*=\s*0x[0-9a-fA-F]{64}/],
  ["BIP-39 style phrase (12+ lowercase words after mnemonic/seed)", /(mnemonic|seed phrase)\s*[:=]\s*["'`]([a-z]{3,8}\s+){11,}[a-z]{3,8}/i],
  ["RPC URL with a key in the path or query", /https?:\/\/[^\s"']*(alchemy|infura|quicknode|ankr|chainstack|drpc|blastapi|tenderly)[^\s"']*\/[A-Za-z0-9_-]{20,}/i],
  ["api key in a query string", /[?&](api[_-]?key|apikey|access[_-]?token|auth)=[A-Za-z0-9_-]{16,}/i],
  ["bearer or token literal", /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{32,}|xox[abp]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|cf[A-Za-z0-9_-]{0,3}_[A-Za-z0-9_-]{36,})\b/],
  ["PEM private key block", /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Foundry keystore JSON (crypto/ciphertext)", /"ciphertext"\s*:\s*"[0-9a-f]{32,}"/i],
];

const fails = [];
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (SKIP_DIRS.has(f) || SKIP_PATHS.includes(p)) return [];
    const st = statSync(p);
    return st.isDirectory() ? walk(p) : [p];
  });
}

const targets = [...walk(REPO)];
for (const f of targets) {
  const rel = relative(REPO, f);
  const name = basename(f);
  if (/^\.env(\.|$)/.test(name) && name !== ".env.example") fails.push(`${rel}: a .env file must not be in the project folder (only .env.example)`);
  if (/\.(pem|key|p12|keystore)$/i.test(name) || /^UTC--/.test(name)) fails.push(`${rel}: key material file`);
  if (!FILE_EXT.test(name)) continue;
  if (statSync(f).size > 4_000_000) continue;
  const text = readFileSync(f, "utf8");
  for (const [label, re] of RULES) {
    const m = re.exec(text);
    if (m) fails.push(`${rel}: ${label}`);
  }
  if (name === ".env.example") {
    for (const line of text.split("\n")) {
      const v = /^[A-Z0-9_]+=(.+)$/.exec(line.trim());
      if (v && /^(0x[0-9a-fA-F]{64}|[A-Za-z0-9_-]{32,})$/.test(v[1])) fails.push(`${rel}: example value looks like a real secret: ${line.slice(0, 40)}`);
    }
  }
}

// The built site must not embed any RPC provider URL other than this site's own /api/rpc (and the chain's official public RPC).
for (const dir of ["out", "out-e2e"]) {
  const base = join(ROOT, dir);
  if (!existsSync(base)) continue;
  for (const f of walk(base)) {
    if (!/\.(html|js|json|txt|css)$/.test(f)) continue;
    const text = readFileSync(f, "utf8");
    const url = /RPC_UPSTREAM_URL/.exec(text);
    if (url) fails.push(`${dir}/${relative(base, f)}: references RPC_UPSTREAM_URL (server-only secret name leaked into the bundle)`);
  }
}

if (fails.length) {
  console.error(`secrets:check found ${fails.length} problem(s):\n${fails.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log(`secrets:check passed: ${targets.length} files scanned, no keys, seed phrases, provider keys or .env files.`);
