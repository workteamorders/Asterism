import { formatEther, type Address } from "viem";

/** ETH with up to `digits` significant decimals, never scientific notation. */
export function formatEth(wei: bigint, digits = 6): string {
  const s = formatEther(wei);
  const [int, frac = ""] = s.split(".");
  const trimmed = frac.slice(0, digits).replace(/0+$/, "");
  const grouped = Number(int).toLocaleString("en-US");
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

export function formatInt(n: bigint | number): string {
  return Number(n).toLocaleString("en-US");
}

export function shortAddress(a: Address | string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function formatUtc(ts: bigint | number): string {
  const d = new Date(Number(ts) * 1000);
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** "in about 3 hours" / "about 2 days ago". Chain time can differ from the clock by minutes, so it is approximate. */
export function relativeTime(ts: bigint | number, nowSeconds: number = Date.now() / 1000): string {
  const diff = Number(ts) - nowSeconds;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const [value, unit] =
    abs < 3600 ? [Math.round(diff / 60), "minute"] : abs < 86400 * 2 ? [Math.round(diff / 3600), "hour"] : [Math.round(diff / 86400), "day"];
  return `about ${rtf.format(value, unit as Intl.RelativeTimeFormatUnit).replace(/^in /, "in ")}`;
}

export function percent(part: bigint, whole: bigint, digits = 1): string {
  if (whole === 0n) return "0%";
  return `${((Number(part) / Number(whole)) * 100).toFixed(digits)}%`;
}
