"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { Asterism } from "@/lib/asterism/geometry";
import { asterismFor, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { BRIGHTNESS_RADIUS, CANVAS, TIER_NAMES } from "@/lib/asterism/spec";
import { isDeployed } from "@/lib/chain/deployment";
import { useLauncherState } from "@/lib/hooks/chain";
import { useCollection } from "../gallery/useCollection";
import { Badge } from "../badge/Badge";
import { Button } from "../button/Button";
import { ButtonLink } from "../button/ButtonLink";
import { Icon } from "../icon/Icon";
import { LiveReadout } from "./LiveReadout";
import { GRID_PITCH } from "./grid";
import styles from "./StarMap.module.css";

const PREVIEW_IDS = [23, 1, 142, 38, 97];
const PREVIEW = PREVIEW_IDS.map((id) => ({ geometry: asterismFor(EXAMPLE_SEED, id), name: "" }));
const POSITIONS = [
  ["19%", "28%"], ["51%", "23%"], ["80%", "36%"], ["32%", "70%"], ["69%", "76%"],
];

type MapEntry = { geometry: Asterism; name: string };

export function StarMap() {
  const launch = useLauncherState();
  if (launch.data?.revealed) return <RevealedMap />;
  const previewReason = !isDeployed
    ? "The launch is not deployed and its seed has not been revealed. This is a preview."
    : launch.isError || !launch.data
      ? "The launch seed status is unavailable. This sample uses a preview seed."
      : "The launch seed has not been revealed. This sample uses a preview seed.";
  return <Map entries={PREVIEW} previewReason={previewReason} />;
}

function RevealedMap() {
  const collection = useCollection();
  if (!collection.seed || collection.error || collection.loading) {
    const reason = collection.error
      ? "The revealed collection is unavailable. This sample uses a preview seed."
      : "The revealed collection is loading. This sample uses a preview seed.";
    return <Map entries={PREVIEW} previewReason={reason} />;
  }
  const seed = collection.seed;
  const entries = collection.items.slice(0, POSITIONS.length).map(({ id, name }) => ({
    geometry: asterismFor(seed, id),
    name,
  }));
  return <Map entries={entries} />;
}

function labelFor(entry: MapEntry, preview: boolean) {
  const number = String(entry.geometry.id).padStart(4, "0");
  return preview ? `Preview #${number}` : entry.name || `Asterism #${number}`;
}

function Map({ entries, previewReason }: { entries: MapEntry[]; previewReason?: string }) {
  const [id, setId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const sky = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLCanvasElement>(null);
  const drawer = useId();
  const pattern = useId();
  const preview = Boolean(previewReason);
  const index = entries.findIndex((entry) => entry.geometry.id === id);
  const selected = open ? entries[index] : undefined;
  const entryKey = entries.map((entry) => entry.geometry.id).join(",");

  useEffect(() => {
    const element = sky.current;
    const canvas = field.current;
    if (!element || !canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The motion is loaded and started when the browser is idle, so it never competes with first paint.
    let cleanup: (() => void) | undefined;
    let disposed = false;
    const start = () => {
      void import("./sky").then(({ mountSky }) => {
        if (!disposed) cleanup = mountSky(element, canvas);
      });
    };
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 200);
    return () => {
      disposed = true;
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      cleanup?.();
    };
  }, [entryKey]);

  function select(entry: MapEntry, element: HTMLElement) {
    trigger.current = element;
    setId(entry.geometry.id);
    setOpen(true);
  }

  function move(direction: -1 | 1, element: HTMLElement) {
    if (!entries.length) return;
    const next = index < 0
      ? direction === 1 ? 0 : entries.length - 1
      : (index + direction + entries.length) % entries.length;
    select(entries[next]!, element);
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <section className={styles.instrument} aria-labelledby="observatory-heading" onKeyDown={(event) => {
      if (event.key === "Escape" && selected && !event.defaultPrevented) {
        event.preventDefault();
        close();
      }
    }}>
      <header className={styles.intro}>
        <div>
          <h1 className="t-h2" id="observatory-heading">Asterism Observatory</h1>
          <p>Explore constellations drawn by the on-chain renderer.</p>
        </div>
        {preview ? <Badge tone="example">PREVIEW</Badge> : null}
      </header>

      <div className={styles.viewport}>
        <div ref={sky} className={styles.sky} aria-label="Star map" role="group">
          <svg className={styles.grid} aria-hidden="true" width="100%" height="100%">
            <defs>
              <pattern id={pattern} width={GRID_PITCH} height={GRID_PITCH} patternUnits="userSpaceOnUse">
                <path d={`M0 0H${GRID_PITCH}V${GRID_PITCH}`} />
                <path d={`M${GRID_PITCH / 2 - 4} ${GRID_PITCH / 2}H${GRID_PITCH / 2 + 4}M${GRID_PITCH / 2} ${GRID_PITCH / 2 - 4}V${GRID_PITCH / 2 + 4}`} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${pattern})`} />
          </svg>
          <svg className={styles.reticle} aria-hidden="true" viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="170" />
            <circle cx="200" cy="200" r="114" />
            <circle cx="200" cy="200" r="56" />
            <path d="M0 200H400M200 0V400" />
          </svg>

          <canvas ref={field} className={styles.field} aria-hidden="true" />

          {entries.map((entry, i) => {
            const { geometry } = entry;
            const [x, y] = POSITIONS[i]!;
            const active = selected?.geometry.id === geometry.id;
            return (
              <button
                key={geometry.id}
                type="button"
                className={styles.target}
                style={{ "--map-x": x, "--map-y": y, "--sky-order": i } as CSSProperties}
                aria-label={labelFor(entry, preview)}
                aria-expanded={active}
                aria-controls={drawer}
                onClick={(event) => select(entry, event.currentTarget)}
              >
                <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`} className={styles.geometry} aria-hidden="true" data-sky-svg="">
                  {geometry.edges.map(([from, to]) => (
                    <line key={to} data-a={from} data-b={to} x1={geometry.stars[from]!.x} y1={geometry.stars[from]!.y} x2={geometry.stars[to]!.x} y2={geometry.stars[to]!.y} />
                  ))}
                  {geometry.stars.map((star, n) => (
                    <circle key={n} data-s={n} cx={star.x} cy={star.y} r={BRIGHTNESS_RADIUS[star.b]} style={{ "--n": n } as CSSProperties} />
                  ))}
                  <circle className={styles.primary} data-s={geometry.primary} cx={geometry.stars[geometry.primary]!.x} cy={geometry.stars[geometry.primary]!.y} r={12} />
                </svg>
                <span className={styles.targetLabel}>{entry.name || `#${String(geometry.id).padStart(4, "0")}`}</span>
              </button>
            );
          })}

          {!entries.length ? <p className={styles.empty}>No revealed asterisms are available in the collection.</p> : null}
        </div>
        <span className="sr-only" role="status">
          {selected ? `${labelFor(selected, preview)}, ${selected.geometry.stars.length} stars, ${TIER_NAMES[selected.geometry.tier]} tier. Details open.` : ""}
        </span>
        <div id={drawer} role="region" aria-label="Asterism details" className={styles.drawer} hidden={!selected}>
          {selected ? (
            <>
              <div className={styles.drawerHead}>
                <h2 className="t-h4">{labelFor(selected, preview)}</h2>
                <Button size="s" variant="ghost" icon="x" iconOnly label="Close details" onClick={close} />
              </div>
              <dl className={styles.metrics}>
                <div><dt>Identity</dt><dd>#{String(selected.geometry.id).padStart(4, "0")}</dd></div>
                <div><dt>Stars</dt><dd>{selected.geometry.stars.length}</dd></div>
                <div><dt>{preview ? "Preview tier" : "Tier"}</dt><dd>{TIER_NAMES[selected.geometry.tier]}</dd></div>
              </dl>
              {previewReason ? <p className={styles.seed}>{previewReason}</p> : null}
            </>
          ) : null}
        </div>
      </div>

      <div className={styles.console}>
        <div className={styles.navigation} role="group" aria-label="Asterism navigation">
          <Button size="s" aria-label="Previous asterism" disabled={!entries.length} onClick={(event) => move(-1, event.currentTarget)}>
            <Icon name="arrow-right" size={16} className={styles.previous} /> Previous<span className={styles.buttonSuffix}> asterism</span>
          </Button>
          <Button size="s" aria-label="Next asterism" disabled={!entries.length} onClick={(event) => move(1, event.currentTarget)}>
            Next<span className={styles.buttonSuffix}> asterism</span> <Icon name="arrow-right" size={16} />
          </Button>
        </div>
        <div className={styles.launch}>
          <LiveReadout compact />
          <ButtonLink href="/launch/" size="s" iconAfter="arrow-right">Go to the Launch</ButtonLink>
        </div>
      </div>
    </section>
  );
}
