import type { Asterism } from "./geometry";
import { GUIDE_NAMES, MARK_NAMES, TIER_NAMES } from "./spec";
import { renderAsterismSvg, renderUnrevealedSvg, validName } from "./svg";

/** Must equal AsterismRenderer._DESCRIPTION byte for byte. */
export const DESCRIPTION =
  "An asterism drawn entirely on-chain on Robinhood Chain. One whole Asterism token carries one asterism.";

/** ASCII-only base64 that works in Node and in the browser. */
export function base64(ascii: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(ascii, "utf8").toString("base64");
  return btoa(ascii);
}

export function tokenJson(a: Asterism, name?: string | null): string {
  const n = validName(name);
  const image = base64(renderAsterismSvg(a, n));
  return (
    `{"name":"Asterism #${a.id}","description":"${DESCRIPTION}","image":"data:image/svg+xml;base64,${image}",` +
    `"attributes":[{"trait_type":"Tier","value":"${TIER_NAMES[a.tier]}"},` +
    `{"trait_type":"Stars","display_type":"number","value":${a.stars.length}},` +
    `{"trait_type":"Mark","value":"${MARK_NAMES[a.tier]}"},` +
    `{"trait_type":"Guide","value":"${GUIDE_NAMES[a.guide]}"},` +
    `{"trait_type":"Named","value":"${n ? "Yes" : "No"}"}]}`
  );
}

export function unrevealedJson(id: number): string {
  return (
    `{"name":"Asterism #${id}","description":"${DESCRIPTION} Not yet revealed.",` +
    `"image":"data:image/svg+xml;base64,${base64(renderUnrevealedSvg())}",` +
    `"attributes":[{"trait_type":"Status","value":"Unrevealed"}]}`
  );
}

export function tokenUri(a: Asterism, name?: string | null): string {
  return `data:application/json;base64,${base64(tokenJson(a, name))}`;
}

export function unrevealedUri(id: number): string {
  return `data:application/json;base64,${base64(unrevealedJson(id))}`;
}

/** Decodes a data:application/json;base64 token URI as returned by the contract. */
export function decodeTokenUri(uri: string): { name: string; image: string; attributes: { trait_type: string; value: string | number }[] } {
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) throw new Error("unexpected token URI");
  const raw = uri.slice(prefix.length);
  const json = typeof Buffer !== "undefined" ? Buffer.from(raw, "base64").toString("utf8") : atob(raw);
  return JSON.parse(json);
}
