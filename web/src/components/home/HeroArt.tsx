"use client";

import { useMemo } from "react";
import { useLauncherState } from "@/lib/hooks/chain";
import { isDeployed } from "@/lib/chain/deployment";
import { asterismFor, asterismUri, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { MARK_NAMES, TIER_NAMES } from "@/lib/asterism/spec";
import { ConstellationTrace } from "../asterism/ConstellationTrace";
import { Badge } from "../badge/Badge";
import styles from "./Home.module.css";

const EXAMPLE_ID = 97; // a Nova in the example seed: shows every element of the art

/** The hero frame: a real asterism after the reveal, otherwise a labelled EXAMPLE drawn by the same renderer. */
export function HeroArt() {
  const state = useLauncherState();
  const revealed = isDeployed && state.data?.revealed === true;
  const seed = revealed && state.data ? state.data.seed : EXAMPLE_SEED;
  const id = revealed ? 1 : EXAMPLE_ID;
  const a = useMemo(() => asterismFor(seed, id), [seed, id]);
  const src = useMemo(() => asterismUri(seed, id), [seed, id]);
  return (
    <figure className={styles.heroArt}>
      <div className={styles.heroFrame} data-constellation tabIndex={0}>
        {/* eslint-disable-next-line @next/next/no-img-element -- on-chain SVG as data URI */}
        <img
          src={src}
          width={400}
          height={400}
          alt={`${revealed ? "" : "Example "}asterism ${id}: ${TIER_NAMES[a.tier]} tier, ${a.stars.length} stars, ${MARK_NAMES[a.tier].toLowerCase()} primary mark.`}
          fetchPriority="high"
        />
        <ConstellationTrace geometry={a} />
      </div>
      <figcaption className={styles.heroCaption}>
        {revealed ? <Badge icon="reticle">Asterism #{id}</Badge> : <Badge tone="example">Example · seed not revealed</Badge>}
        <span className="t-mono t-muted">
          {TIER_NAMES[a.tier].toUpperCase()} · {a.stars.length} STARS
        </span>
      </figcaption>
    </figure>
  );
}
