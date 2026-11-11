"use client";

import { useEffect, useRef } from "react";
import { interpolateCount } from "../meter/count";

/** Renders the final number in the HTML, then counts up to it once when it first scrolls into view. */
export function CountUp({ value }: { value: number }) {
  const element = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = element.current;
    if (!target || !matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const duration = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--count-duration"));
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          target.textContent = interpolateCount(0, value, progress).toLocaleString("en-US");
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return (
    <span ref={element} className="t-tabular">
      {value.toLocaleString("en-US")}
    </span>
  );
}
