#!/usr/bin/env node
// Generates the reveal secret and its commitment, offline.
//
//   node scripts/gen-commit.mjs                 writes the secret to ~/.asterism/reveal-secret-<label>.txt (mode 0600)
//   node scripts/gen-commit.mjs --label mainnet                    (default label: "launch")
//   node scripts/gen-commit.mjs --out /path/outside/the/repo.txt   (explicit file; refused inside this repository)
//   node scripts/gen-commit.mjs --test          prints a throwaway secret and commit for tests; writes nothing
//
// Only the COMMIT goes into deployments/config/<chainId>.json (field revealCommit).
// The SECRET stays on the revealer's machine until reveal(secret) is called after finalization.
// Back it up in two offline places. If it is lost, the contract falls back to a public seed after the reveal window.
// The secret is never printed to the terminal in normal mode, so it does not land in shell history or logs.
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// keccak256 comes from the site's own dependency (run `pnpm install` in web/ once). Nothing is downloaded at run time.
const { keccak256 } = await import(pathToFileURL(createRequire(join(repo, "web", "package.json")).resolve("viem")).href);
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : (args[i + 1] ?? "");
};
const secret = `0x${randomBytes(32).toString("hex")}`;
const commit = keccak256(secret);

if (args.includes("--test")) {
  console.log("TEST ONLY. Never use these values on a public network.");
  console.log(`secret  ${secret}`);
  console.log(`commit  ${commit}`);
  process.exit(0);
}

const label = (flag("--label") ?? "launch").replace(/[^A-Za-z0-9_-]/g, "");
if (!label) throw new Error("label must contain letters, digits, _ or -");
const out = resolve(flag("--out") ?? join(homedir(), ".asterism", `reveal-secret-${label}.txt`));
const rel = relative(repo, out);
if (!rel.startsWith("..") && !isAbsolute(rel)) {
  console.error(`Refusing to write the secret inside the repository (${out}). Choose a location outside ${repo}.`);
  process.exit(1);
}
if (existsSync(out)) {
  console.error(`${out} already exists. Not overwriting a secret. Move it or pick another --label.`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
writeFileSync(out, `${secret}\n`, { mode: 0o600, flag: "wx" });
chmodSync(out, 0o600);

console.log(`Secret written to ${out} (permissions 0600). It is not shown here.`);
console.log("");
console.log(`revealCommit  ${commit}`);
console.log("");
console.log("Put revealCommit in deployments/config/<chainId>.json. Keep the secret file offline and backed up twice.");
console.log("Publish the secret only when you call reveal(secret), after finalization.");
