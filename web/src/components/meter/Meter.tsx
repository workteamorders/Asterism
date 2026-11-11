"use client";

import { useLayoutEffect, useRef } from "react";
import { formatInt, percent } from "@/lib/format";
import { interpolateCount } from "./count";
import styles from "./Meter.module.css";

/** Sale progress: a measured bar with a text equivalent for assistive technology. */
export function Meter({ label, value, max, showPercent = false }: { label: string; value: number; max: number; showPercent?: boolean }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const suffix = ` of ${formatInt(max)} tokens${showPercent ? ` (${percent(BigInt(value), BigInt(max))})` : ""}`;
  const valueText = formatInt(value) + suffix;
  const digits = useRef<HTMLSpanElement>(null);
  const last = useRef(value);

  useLayoutEffect(() => {
    const element = digits.current;
    if (!element) return;
    const from = last.current;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const duration = parseFloat(getComputedStyle(element).getPropertyValue("--instrument-trace"));
    let frame = 0;
    let start: number | undefined;
    function update(count: number) {
      last.current = count;
      element!.textContent = formatInt(count);
    }
    function tick(now: number) {
      start ??= now;
      const progress = (now - start) / duration;
      update(interpolateCount(from, value, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      if (motion.matches || from === value) update(value);
      else {
        update(last.current);
        frame = requestAnimationFrame(tick);
      }
    }
    sync();
    motion.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", sync);
    };
  }, [value]);

  return (
    <div className={styles.meter}>
      <div className={styles.labels}>
        <span className="t-label t-muted">{label}</span>
        <span className={styles.value} aria-hidden="true"><span ref={digits}>{formatInt(value)}</span>{suffix}</span>
      </div>
      <div className={styles.track} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}>
        <span className={styles.fill} style={{ transform: `scaleX(${ratio})` }} />
        <span className={styles.ticks} aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} />
          ))}
        </span>
      </div>
    </div>
  );
}
