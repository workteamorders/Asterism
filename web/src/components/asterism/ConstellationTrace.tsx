import type { CSSProperties } from "react";
import type { Asterism } from "@/lib/asterism/geometry";
import { CANVAS, BRIGHTNESS_RADIUS } from "@/lib/asterism/spec";
import styles from "./AsterismImage.module.css";

export function ConstellationTrace({ geometry }: { geometry: Asterism }) {
  const { stars, edges } = geometry;
  const lines = edges.map(([from, to]) => {
    const a = stars[from]!;
    const b = stars[to]!;
    return `M${a.x} ${a.y}L${b.x} ${b.y}`;
  }).join("");

  return (
    <svg className={styles.trace} viewBox={`0 0 ${CANVAS} ${CANVAS}`} aria-hidden="true">
      <path d={lines} pathLength={1} />
      {stars.map((star, index) => (
        <circle key={index} cx={star.x} cy={star.y} r={BRIGHTNESS_RADIUS[star.b]} style={{ "--star-order": index } as CSSProperties} />
      ))}
    </svg>
  );
}
