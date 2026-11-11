"use client";

import { useId, useState } from "react";
import { asterismUri, EXAMPLE_SEED } from "@/lib/asterism/preview";
import styles from "./FocusPuzzle.module.css";

/** A small playable 404: slide until the asterism is sharp. Opacity-only "blur" so it stays cheap and reduced-motion safe. */
export function FocusPuzzle() {
  const [v, setV] = useState(12);
  const id = useId();
  const target = 50;
  const off = Math.abs(v - target);
  const sharp = off <= 2;
  return (
    <div className={styles.wrap}>
      <div className={styles.frame} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- example render */}
        <img src={asterismUri(EXAMPLE_SEED, 404)} alt="" className={styles.base} style={{ opacity: sharp ? 1 : 0.15 + 0.6 * (1 - off / 50) }} width={400} height={400} />
        {[-1, 1].map((d) => (
          // eslint-disable-next-line @next/next/no-img-element -- ghost copies give the out-of-focus look
          <img key={d} src={asterismUri(EXAMPLE_SEED, 404)} alt="" className={styles.ghost} style={{ transform: `translate(${(d * off) / 6}px, ${(-d * off) / 9}px)`, opacity: sharp ? 0 : 0.35 }} width={400} height={400} />
        ))}
      </div>
      <label htmlFor={id} className="t-label t-muted">
        Focus
      </label>
      <input id={id} className={styles.slider} type="range" min={0} max={100} step={1} value={v} onChange={(e) => setV(Number(e.target.value))} aria-valuetext={sharp ? "In focus" : `${off} steps out of focus`} />
      <p className="t-small t-muted" aria-live="polite">
        {sharp ? "In focus. Example asterism #404." : "Out of focus."}
      </p>
    </div>
  );
}
