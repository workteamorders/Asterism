// Reference specification for the Asterism renderer.
// The Solidity renderer must reproduce these rules exactly; tests compare both.
// Integer arithmetic only. No floats.

export const MAX_SUPPLY_TOKENS = 2222;

export type Tier = 0 | 1 | 2 | 3 | 4;

export const TIER_NAMES = ["Dust", "Ember", "Star", "Giant", "Nova"] as const;
export const MARK_NAMES = ["Dot", "Ring", "Four-point", "Eight-point", "Eight-point with halo"] as const;

/** Exact number of asterisms per tier when every id 1..MAX_SUPPLY_TOKENS exists. */
export const TIER_COUNTS: readonly number[] = [1200, 600, 300, 100, 22];

/** Inclusive star-count range per tier. */
export const TIER_STARS: readonly (readonly [number, number])[] = [
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 13],
  [14, 16],
];

export const MAX_STARS = 16;

/** Canvas, in SVG user units. */
export const CANVAS = 400;

/** Star field (inclusive bounds). Leaves a readout band above and a name band below. */
export const FIELD = { x0: 44, x1: 356, y0: 60, y1: 332 } as const;

/** Minimum distance between any two stars, and its square. */
export const MIN_DIST = 34;
export const MIN_DIST_SQ = MIN_DIST * MIN_DIST;

/** Random placement attempts per star before the deterministic lattice fallback. */
export const ATTEMPTS_PER_STAR = 24;

/**
 * Fallback lattice: hexagonal rows. Row pitch 30, column pitch 34, odd rows shifted by 17.
 * Nearest-neighbour distance is min(34, sqrt(17^2 + 30^2) = 34.48) >= MIN_DIST.
 * An open disc of radius MIN_DIST can hold at most 5 points that are pairwise >= MIN_DIST apart,
 * so each placed star blocks at most 5 lattice slots. With at most 15 stars already placed,
 * at most 75 slots are blocked, and the lattice below has more than 75 slots, so a free slot always exists.
 */
export const LATTICE = { rowPitch: 30, colPitch: 34, oddShift: 17 } as const;

/** Brightness classes: radius in user units, chosen with weights out of 6. */
export const BRIGHTNESS_RADIUS: readonly number[] = [2, 3, 4];
export const BRIGHTNESS_WEIGHTS: readonly number[] = [3, 2, 1];

export const GUIDE_NAMES = ["None", "Focus rings", "Sensor grid"] as const;
export type Guide = 0 | 1 | 2;

/** Names: printable subset, enforced on-chain by setName. */
export const NAME_MAX_BYTES = 48;
export const NAME_ALLOWED = /^[A-Za-z0-9 .,!?'-]*$/;

/** Colours baked into the token image (Diffraction direction). */
export const ART = {
  ground: "#121315",
  guide: "#24262B",
  tick: "#5A5E66",
  line: "#4B4E55",
  star: "#FFF4E0",
  readout: "#9A9EA6",
  name: "#ECEDEE",
} as const;

/** Outer radius of each tier mark, for layout checks. Nova's halo (33) stays inside MIN_DIST (34). */
export const MARK_RADIUS: readonly number[] = [8, 11, 18, 20, 33];

/** Text bands: readout baseline and name baseline. Marks and stars must stay clear of both. */
export const READOUT_BASELINE = 24;
export const NAME_BASELINE = 384;
