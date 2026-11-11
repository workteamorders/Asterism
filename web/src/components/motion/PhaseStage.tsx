"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Asterism } from "@/lib/asterism/geometry";
import { BRIGHTNESS_RADIUS, CANVAS } from "@/lib/asterism/spec";
import { Badge } from "../badge/Badge";
import s from "./motion.module.css";

export interface Phase {
  label: string;
  title: string;
  body: string;
  caption: string;
}

/**
 * The three launch phases. On wide screens the drawing stays in view while the text scrolls past it, and the drawing
 * changes with the phase being read: sealed stars, the pool ring, then the revealed lines. It is an EXAMPLE seed.
 */
export function PhaseStage({ phases, geometry }: { phases: readonly Phase[]; geometry: Asterism }) {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const items = list.current?.querySelectorAll<HTMLElement>("[data-phase-index]");
    if (!items) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (isIntersecting) setActive(Number((target as HTMLElement).dataset.phaseIndex));
        }
      },
      { rootMargin: "-42% 0px -48% 0px" },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  const { stars, edges } = geometry;
  const lines = edges
    .map(([from, to]) => `M${stars[from]!.x} ${stars[from]!.y}L${stars[to]!.x} ${stars[to]!.y}`)
    .join("");
  const current = phases[active]!;

  return (
    <div className={s.stage} data-phase={active}>
      <figure className={s.stageFigure}>
        <div className={s.stageFrame}>
          <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`} className={s.stageSvg} aria-hidden="true">
            <g className={s.stageGrid}>
              {[60, 120, 180].map((r) => (
                <circle key={r} cx={CANVAS / 2} cy={CANVAS / 2} r={r} />
              ))}
            </g>
            <circle className={s.stagePool} cx={CANVAS / 2} cy={CANVAS / 2} r={150} pathLength={1} />
            <path className={s.stageLines} d={lines} pathLength={1} />
            {stars.map((star, index) => (
              <circle
                key={index}
                className={s.stageStar}
                cx={star.x}
                cy={star.y}
                r={BRIGHTNESS_RADIUS[star.b]}
                style={{ "--star-order": index } as CSSProperties}
              />
            ))}
          </svg>
          <span className={s.stageTag}>{current.label}</span>
        </div>
        <figcaption className={s.stageCaption}>
          <Badge tone="example">Example</Badge>
          <span aria-live="polite">{current.caption}</span>
        </figcaption>
      </figure>
      <ol className={s.phaseList} ref={list}>
        {phases.map((phase, index) => (
          <li key={phase.label} className={s.phaseItem} data-phase-index={index} data-current={index === active ? "" : undefined}>
            <span className={s.phaseLabel}>{phase.label}</span>
            <h3>{phase.title}</h3>
            <p>{phase.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
