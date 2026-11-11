import type { Hex } from "viem";
import { buildAsterism } from "@/lib/asterism/geometry";
import { CANVAS } from "@/lib/asterism/spec";

export function fieldLayout(seed: Hex, patches: number, width: number, height: number) {
  const columns = Math.min(patches, Math.max(1, Math.round(Math.sqrt(patches * width / height))));
  const rows = Math.ceil(patches / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const scale = Math.min(cellWidth, cellHeight) / CANVAS;
  const stars: { x: number; y: number; b: number }[] = [];
  const edges: [number, number][] = [];

  for (let index = 0; index < patches; index++) {
    const shape = buildAsterism(seed, index + 1);
    const centerX = (index % columns + 0.5) * cellWidth;
    const centerY = (Math.floor(index / columns) + 0.5) * cellHeight;
    const offset = stars.length;
    for (const star of shape.stars) {
      stars.push({
        x: centerX + (star.x - CANVAS / 2) * scale,
        y: centerY + (star.y - CANVAS / 2) * scale,
        b: star.b,
      });
    }
    for (const [a, b] of shape.edges) edges.push([a + offset, b + offset]);
  }
  return { stars, edges };
}

export function shouldAnimate(reduced: boolean, hidden: boolean, onscreen: boolean) {
  return !reduced && !hidden && onscreen;
}
