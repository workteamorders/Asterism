// pnpm copy:check — fails on banned marketing words and on claims the site must never make.
// Scans (1) the visible text, alt text, aria labels and meta of every built page in out/ and
// (2) string literals and JSX text in src/ (client-rendered states never reach the built HTML).
// Disclaimers such as "no rewards" or "not an investment" are allowed; anything else is a failure.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const BANNED = [
  /\bearn(s|ed|ing|ings)?\b/i,
  /\byield(s|ing)?\b/i,
  /\bprofit(s|able|ability)?\b/i,
  /\bpassive income\b/i,
  /\bAPY\b/,
  /\bAPR\b/,
  /\brewards?\b/i,
  /\bdividends?\b/i,
  /\binvest(s|ed|ing|ment|ments|or|ors)?\b/i,
  /\bguarantee(s|d)?\b/i,
  /\bto the moon\b/i,
  /\bmoon(ing|shot)?\b/i,
  /\bfloor price\b/i,
  /\b(scarce|scarcity|rare|rarity)\b/i,
  /\b(only \d+ left|selling fast|last chance|don'?t miss|hurry|sell(ing)? out soon|FOMO)\b/i,
  /\b(100x|10x|1000x|lambo)\b/i,
  /\bverified\b/i,
  /\baudited\b/i,
  /\bsafe\b/i,
  /\bsecure[ds]?\b/i,
  /\bwen\b/i,
];

// Phrases in which a banned word is a disclaimer or a factual description, matched case-insensitively.
const ALLOWED = [
  /no (external )?audit/i,
  /not (been )?(reviewed|audited)/i,
  /(has|have) not been (externally )?audited/i,
  /not an? (investment|audit|promise)/i,
  /no rewards?/i,
  /(does|do|will) not (earn|pay|yield|produce)/i,
  /nothing (is )?(earned|guaranteed)/i,
  /no (yield|profit|dividends?|guarantee|guarantees|returns?)/i,
  /(is|are) not (a )?(guaranteed|guarantee)/i,
  /not (guaranteed|a guarantee)/i,
  /(promise|promises) (nothing|no)/i,
  /no (floor|price floor)/i,
  /(cannot|can't|can not|does not|do not|never) (guarantee|promise)/i,
  /without (a )?guarantee/i,
  /source (verified|not verified) on explorer/i,
  /(unverified|not verified)/i,
  /verified (against|by|with|locally|in your browser)/i,
  /(never|not) (safe|secure)/i,
  /safe(ly)? (sending|send|to send|transfer|transferring)/i,
  /(sending|send|transfer) safe(ly)?/i,
  /safety/i,
  /secure (boot|context|storage)/i,
  /securely/i,
  /invest(ment)?( advice)?[^.]{0,30}(not|no)\b/i,
  /not financial( or investment)? advice/i,
  /no (fees?|tax)[^.]{0,40}(project|treasury)/i,
  /rarity in this collection describes the art/i,
  /(wallet|recovery phrase|seed phrase|keys?) safe/i,
  /rare[^.]{0,20}(tier|tiers)/i,
];

const fails = [];
const check = (where, text) => {
  for (const re of BANNED) {
    const m = re.exec(text);
    if (!m) continue;
    const from = Math.max(0, m.index - 60);
    const window = text.slice(from, m.index + m[0].length + 60);
    // An allowance only counts when its match covers the banned word itself.
    const at = m.index - from;
    const covered = ALLOWED.some((a) => {
      const g = new RegExp(a.source, "gi");
      for (let x = g.exec(window); x; x = g.exec(window)) {
        if (x.index <= at && at + m[0].length <= x.index + x[0].length) return true;
        if (x[0].length === 0) g.lastIndex++;
      }
      return false;
    });
    if (covered) continue;
    fails.push(`${where}: "${m[0]}" in …${window.replace(/\s+/g, " ").trim()}…`);
  }
};

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// (1) Built pages.
for (const f of walk(join(ROOT, "out")).filter((p) => p.endsWith(".html"))) {
  const html = readFileSync(f, "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ");
  const attrs = [...html.matchAll(/\b(?:alt|aria-label|title|content|placeholder)="([^"]*)"/g)].map((m) => m[1]).join("\n");
  const visible = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&apos;/g, "'");
  check(`out/${relative(join(ROOT, "out"), f)}`, `${visible}\n${attrs}`);
}

// (2) Source: JSX text and string literals only, comments and imports removed.
const SKIP = [/\/styleguide\//, /\.test\.ts$/, /\/generated\//, /\/lib\/asterism\/(spec|prng|tier|geometry)\.ts$/];
for (const f of walk(join(ROOT, "src")).filter((p) => /\.(tsx?|mdx?)$/.test(p) && !SKIP.some((s) => s.test(p)))) {
  const src = readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/^\s*import .*$/gm, " ");
  const strings = [...src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]).filter((s) => /\s/.test(s) && /[A-Za-z]{3}/.test(s) && !/^(use |[./@#])/.test(s));
  const jsx = [...src.matchAll(/>([^<>{}]*[A-Za-z]{3}[^<>{}]*)</g)].map((m) => m[1]);
  check(`src/${relative(join(ROOT, "src"), f)}`, [...strings, ...jsx].join("\n"));
}

if (fails.length) {
  console.error(`copy:check found ${fails.length} problem(s):\n${[...new Set(fails)].map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("copy:check passed: no banned words or promises in built pages or source copy.");
