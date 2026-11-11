import { keccak256, toHex, type Hex } from "viem";
import { buildAsterism, type Asterism } from "@/lib/asterism/geometry";
import { renderAsterismSvg, renderUnrevealedSvg, svgDataUri } from "@/lib/asterism/svg";
import { GUIDE_NAMES, MARK_NAMES, MAX_SUPPLY_TOKENS, TIER_NAMES, TIER_STARS } from "@/lib/asterism/spec";
import { contrast } from "@/lib/color";

/** EXAMPLE seed. The real seed only exists after the reveal on-chain. */
export const EXAMPLE_SEED: Hex = keccak256(toHex("asterism-styleguide-example"));

export interface Rendered {
  a: Asterism;
  src: string;
  alt: string;
  name: string | null;
}

export function describe(a: Asterism, name: string | null): string {
  const tier = TIER_NAMES[a.tier];
  return `Example asterism ${a.id}: ${tier} tier, ${a.stars.length} stars, ${MARK_NAMES[a.tier].toLowerCase()} primary mark, ${GUIDE_NAMES[a.guide].toLowerCase()} guide${name ? `, named "${name}"` : ""}.`;
}

function render(a: Asterism, name: string | null = null): Rendered {
  return { a, src: svgDataUri(renderAsterismSvg(a, name)), alt: describe(a, name), name };
}

const all: Asterism[] = [];
for (let id = 1; id <= MAX_SUPPLY_TOKENS; id++) all.push(buildAsterism(EXAMPLE_SEED, id));

/** First id of each tier whose star count is the tier maximum, so the range is visible. */
export const byTier: Rendered[] = TIER_NAMES.map((_, t) => {
  const max = (TIER_STARS[t] as readonly [number, number])[1];
  const pick = all.find((a) => a.tier === t && a.stars.length === max && a.guide === 1) ?? all.find((a) => a.tier === t);
  if (!pick) throw new Error("tier without example");
  return render(pick);
});

export const byGuide: Rendered[] = [0, 1, 2].map((g) => {
  const pick = all.find((a) => a.tier === 2 && a.guide === g);
  if (!pick) throw new Error("guide without example");
  return render(pick);
});

const namedPick = all.find((a) => a.tier === 3 && a.guide === 0) ?? all[0]!;
export const named: Rendered = render(namedPick, "Lantern over the quiet field");
export const unnamedSame: Rendered = render(namedPick, null);
export const unrevealedSrc = svgDataUri(renderUnrevealedSvg());

export const stats = (() => {
  const counts = [0, 0, 0, 0, 0];
  const starCounts = new Map<number, number>();
  let maxBytes = 0;
  let fallback = 0;
  const unique = new Set<string>();
  for (const a of all) {
    counts[a.tier]! += 1;
    starCounts.set(a.stars.length, (starCounts.get(a.stars.length) ?? 0) + 1);
    const svg = renderAsterismSvg(a, null);
    maxBytes = Math.max(maxBytes, new TextEncoder().encode(svg).length);
    fallback += a.fallbackStars;
    unique.add(svg);
  }
  return { counts, unique: unique.size, maxBytes, fallback, total: all.length };
})();

export interface Swatch {
  token: string;
  hex: string;
  role: string;
  against?: string;
}

export const SURFACE = "#121315";

export const swatchGroups: { title: string; items: Swatch[] }[] = [
  {
    title: "Surfaces",
    items: [
      { token: "--surface", hex: "#121315", role: "Base housing" },
      { token: "--surface-sunken", hex: "#0c0d0e", role: "Inputs, wells" },
      { token: "--surface-raised", hex: "#1c1d20", role: "Panels, cards" },
      { token: "--surface-floating", hex: "#26282c", role: "Dialogs, menus" },
    ],
  },
  {
    title: "Lines",
    items: [
      { token: "--line", hex: "#2e3035", role: "Decorative separators" },
      { token: "--line-strong", hex: "#6a6e76", role: "Component borders", against: SURFACE },
    ],
  },
  {
    title: "Text",
    items: [
      { token: "--text", hex: "#ecedee", role: "Primary text", against: SURFACE },
      { token: "--text-muted", hex: "#9a9ea6", role: "Secondary text", against: SURFACE },
    ],
  },
  {
    title: "Accent and support",
    items: [
      { token: "--accent", hex: "#b9f15a", role: "Focus confirm. The one action that matters", against: SURFACE },
      { token: "--starlight", hex: "#fff4e0", role: "Stars, marks, art", against: SURFACE },
    ],
  },
  {
    title: "Status",
    items: [
      { token: "--success", hex: "#4fd1a1", role: "Confirmed", against: SURFACE },
      { token: "--warning", hex: "#f0b04a", role: "Check before continuing", against: SURFACE },
      { token: "--danger", hex: "#ff7b6b", role: "Failed or irreversible", against: SURFACE },
      { token: "--info", hex: "#7fb2ff", role: "Neutral information", against: SURFACE },
    ],
  },
];

export function ratio(a: string, b: string): string {
  return `${contrast(a, b).toFixed(1)}:1`;
}

export const tierRows = TIER_NAMES.map((name, t) => ({
  name,
  mark: MARK_NAMES[t],
  stars: `${TIER_STARS[t]![0]} to ${TIER_STARS[t]![1]}`,
}));
