import type { Asterism } from "./geometry";
import { ART, BRIGHTNESS_RADIUS, CANVAS, NAME_ALLOWED, NAME_MAX_BYTES, type Tier } from "./spec";

// Every coordinate below is an integer, so the Solidity renderer can emit the same bytes.
// Only the primary star carries a shaped mark; ordinary stars are plain discs, so the tier mark
// is never confused with a bright star at thumbnail size.

const FOUR_POINT: readonly [number, number][] = [
  [0, -18], [3, -3], [18, 0], [3, 3], [0, 18], [-3, 3], [-18, 0], [-3, -3],
];

const EIGHT_POINT: readonly [number, number][] = [
  [0, -20], [2, -4], [9, -9], [4, -2], [20, 0], [4, 2], [9, 9], [2, 4],
  [0, 20], [-2, 4], [-9, 9], [-4, 2], [-20, 0], [-4, -2], [-9, -9], [-2, -4],
];

function polygon(cx: number, cy: number, pts: readonly [number, number][]): string {
  const d = pts.map(([dx, dy], i) => `${i === 0 ? "M" : "L"}${cx + dx} ${cy + dy}`).join("");
  return `<path d="${d}Z" fill="${ART.star}"/>`;
}

export function tierMark(tier: Tier, cx: number, cy: number): string {
  switch (tier) {
    case 0:
      return `<circle cx="${cx}" cy="${cy}" r="8" fill="${ART.star}"/>`;
    case 1:
      return (
        `<circle cx="${cx}" cy="${cy}" r="11" fill="none" stroke="${ART.star}" stroke-width="2"/>` +
        `<circle cx="${cx}" cy="${cy}" r="4" fill="${ART.star}"/>`
      );
    case 2:
      return polygon(cx, cy, FOUR_POINT);
    case 3:
      return polygon(cx, cy, EIGHT_POINT);
    case 4:
      return (
        `<circle cx="${cx}" cy="${cy}" r="33" fill="none" stroke="${ART.star}" stroke-width="1" stroke-dasharray="2 4"/>` +
        `<circle cx="${cx}" cy="${cy}" r="25" fill="none" stroke="${ART.star}" stroke-width="2"/>` +
        polygon(cx, cy, EIGHT_POINT)
      );
  }
}

function frame(): string {
  return (
    `<rect width="${CANVAS}" height="${CANVAS}" fill="${ART.ground}"/>` +
    `<path d="M200 0V8M200 392V400M0 200H8M392 200H400" stroke="${ART.tick}" stroke-width="1"/>`
  );
}

function guide(kind: number): string {
  if (kind === 1) {
    return [56, 112, 160]
      .map((r) => `<circle cx="200" cy="196" r="${r}" fill="none" stroke="${ART.guide}" stroke-width="1"/>`)
      .join("");
  }
  if (kind === 2) {
    let d = "";
    for (let x = 40; x <= 360; x += 40) d += `M${x} 56V336`;
    for (let y = 56; y <= 336; y += 40) d += `M40 ${y}H360`;
    return `<path d="${d}" stroke="${ART.guide}" stroke-width="1"/>`;
  }
  return "";
}

function readout(left: string, right: string): string {
  return (
    `<text x="20" y="24" fill="${ART.readout}" font-size="12" letter-spacing="1">${left}</text>` +
    `<text x="380" y="24" fill="${ART.readout}" font-size="12" letter-spacing="1" text-anchor="end">${right}</text>`
  );
}

/** Returns the name if it is valid, otherwise null. Mirrors the on-chain check. */
export function validName(name: string | null | undefined): string | null {
  if (!name) return null;
  if (new TextEncoder().encode(name).length > NAME_MAX_BYTES) return null;
  if (!NAME_ALLOWED.test(name)) return null;
  return name;
}

function nameLine(name: string): string {
  // Monospace glyphs are about 0.6em wide: 34 chars at 15 units and 48 chars at 12 units both fit in 360.
  const size = name.length <= 34 ? 15 : 12;
  return `<text x="200" y="384" fill="${ART.name}" font-size="${size}" text-anchor="middle">${name}</text>`;
}

export function pad4(id: number): string {
  return String(id).padStart(4, "0");
}

export function renderAsterismSvg(a: Asterism, name?: string | null): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" font-family="monospace">`,
  );
  parts.push(frame(), guide(a.guide));
  let lines = "";
  for (const [i, j] of a.edges) {
    const p = a.stars[i];
    const q = a.stars[j];
    if (p && q) lines += `M${p.x} ${p.y}L${q.x} ${q.y}`;
  }
  parts.push(`<path d="${lines}" stroke="${ART.line}" stroke-width="1" fill="none"/>`);
  a.stars.forEach((s, i) => {
    if (i === a.primary) return;
    parts.push(`<circle cx="${s.x}" cy="${s.y}" r="${BRIGHTNESS_RADIUS[s.b]}" fill="${ART.star}"/>`);
  });
  const primary = a.stars[a.primary];
  if (primary) parts.push(tierMark(a.tier, primary.x, primary.y));
  parts.push(readout(`ASTERISM ${pad4(a.id)}`, `${a.stars.length} STARS`));
  const n = validName(name);
  if (n) parts.push(nameLine(n));
  parts.push("</svg>");
  return parts.join("");
}

/** Identical for every id until the reveal. */
export function renderUnrevealedSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" font-family="monospace">` +
    frame() +
    guide(1) +
    `<path d="M184 196H194M206 196H216M200 180V190M200 202V212" stroke="${ART.tick}" stroke-width="1"/>` +
    readout("ASTERISM", "UNREVEALED") +
    `<text x="200" y="384" fill="${ART.readout}" font-size="12" letter-spacing="1" text-anchor="middle">NOT YET REVEALED</text>` +
    "</svg>"
  );
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
