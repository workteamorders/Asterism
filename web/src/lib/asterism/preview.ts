import { keccak256, toHex, type Hex } from "viem";
import { buildAsterism, type Asterism } from "./geometry";
import { base64 } from "./metadata";
import { renderAsterismSvg, renderUnrevealedSvg } from "./svg";

/** EXAMPLE seed for previews before the reveal. Never presented as the launch seed. */
export const EXAMPLE_SEED: Hex = keccak256(toHex("asterism-styleguide-example"));

const cache = new Map<string, Asterism>();

export function asterismFor(seed: Hex, id: number): Asterism {
  const key = `${seed}:${id}`;
  let a = cache.get(key);
  if (!a) {
    a = buildAsterism(seed, id);
    if (cache.size > 5000) cache.clear();
    cache.set(key, a);
  }
  return a;
}

export function svgUri(svg: string): string {
  return `data:image/svg+xml;base64,${base64(svg)}`;
}

export function asterismUri(seed: Hex, id: number, name?: string | null): string {
  return svgUri(renderAsterismSvg(asterismFor(seed, id), name));
}

export const UNREVEALED_URI = svgUri(renderUnrevealedSvg());
