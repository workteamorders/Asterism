"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import type { Asterism } from "@/lib/asterism/geometry";
import { BRIGHTNESS_RADIUS, CANVAS } from "@/lib/asterism/spec";
import { E2E } from "@/lib/env";
import { SEEN } from "./boot";
import s from "./intro.module.css";

/**
 * The opening: a reticle and a constellation are drawn, ASTERISM resolves, then a shutter splits along the seam and the
 * home page, already rendered underneath, is revealed. It plays once per browser session, only on the home page, never
 * under reduced motion, and any click, key press, scroll or touch skips it. Without JavaScript it still runs and removes
 * itself with CSS alone.
 */
export function Intro({ geometry }: { geometry: Asterism }) {
  const path = usePathname();
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const home = path === "/";

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (!home) return;
    const remember = () => {
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {
        /* storage can be unavailable; the intro then plays on each load */
      }
    };
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
    } catch {
      /* ignore */
    }
    if (seen || E2E || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      html.setAttribute("data-intro", "off");
      if (root.current) root.current.hidden = true;
      return;
    }
    html.setAttribute("data-intro", "on");
    const total = Number.parseFloat(getComputedStyle(root.current ?? html).getPropertyValue("--intro-end"));
    const finish = () => {
      remember();
      html.setAttribute("data-intro", "off");
      setDone(true);
    };
    const timer = window.setTimeout(finish, total + 150);
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) window.addEventListener(name, finish, { once: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, finish);
    };
  }, [home]);

  if (!home || done) return null;
  const { stars, edges } = geometry;
  const lines = edges.map(([a, b]) => `M${stars[a]!.x} ${stars[a]!.y}L${stars[b]!.x} ${stars[b]!.y}`).join("");
  return (
    <div ref={root} className={s.intro} aria-hidden="true">
      <div className={`${s.half} ${s.top}`} />
      <div className={`${s.half} ${s.bottom}`} />
      <div className={s.seam} />
      <div className={s.content}>
        <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`} className={s.art}>
          <circle className={s.ring} cx={CANVAS / 2} cy={CANVAS / 2} r={CANVAS * 0.46} pathLength={1} />
          <path className={s.lines} d={lines} pathLength={1} />
          {stars.map((star, i) => (
            <circle key={i} className={s.star} cx={star.x} cy={star.y} r={BRIGHTNESS_RADIUS[star.b]} style={{ "--i": i } as CSSProperties} />
          ))}
        </svg>
        <p className={s.word}>
          {"ASTERISM".split("").map((letter, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              {letter}
            </span>
          ))}
        </p>
        <p className={s.meta}>2,222 asterisms · Robinhood Chain</p>
      </div>
      <p className={s.hint}>Click or press any key to skip</p>
    </div>
  );
}
