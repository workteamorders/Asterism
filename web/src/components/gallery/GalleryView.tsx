"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MARK_NAMES, MAX_SUPPLY_TOKENS, TIER_NAMES, type Tier } from "@/lib/asterism/spec";
import { asterismUri, UNREVEALED_URI } from "@/lib/asterism/preview";
import { explain } from "@/lib/chain/errors";
import { Badge } from "../badge/Badge";
import { Button } from "../button/Button";
import { Field } from "../field/Field";
import { Skeleton } from "../skeleton/Skeleton";
import { EmptyState, ErrorState } from "../state/States";
import { Notice } from "../notice/Notice";
import { DetailView } from "./DetailView";
import styles from "./Gallery.module.css";
import { useCollection, type Item } from "./useCollection";

const PAGE = 24;

export function GalleryView() {
  const params = useSearchParams();
  const idParam = params.get("id");
  if (idParam !== null) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id < 1 || id > MAX_SUPPLY_TOKENS) {
      return (
        <EmptyState title="That id is outside the collection" action={<Link href="/gallery/">Back to the gallery</Link>}>
          Asterism ids run from 1 to {MAX_SUPPLY_TOKENS.toLocaleString("en-US")}.
        </EmptyState>
      );
    }
    return <DetailView id={id} />;
  }
  return <Grid />;
}

function Grid() {
  const c = useCollection();
  const [tier, setTier] = useState<Tier | "all">("all");
  const [namedOnly, setNamedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [desc, setDesc] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const revealed = c.mode !== "unrevealed";

  const filtered = useMemo(() => {
    let list: Item[] = c.items;
    if (tier !== "all") list = list.filter((i) => i.tier === tier);
    if (namedOnly) list = list.filter((i) => i.name);
    const q = query.trim().replace(/^#/, "");
    if (q) list = list.filter((i) => String(i.id).startsWith(q) || i.name.toLowerCase().includes(q.toLowerCase()));
    return desc ? [...list].reverse() : list;
  }, [c.items, tier, namedOnly, query, desc]);

  if (c.error) {
    const e = explain(c.error, "read");
    return (
      <ErrorState
        title="The gallery could not be read"
        what={e.detail}
        safety="No asset is affected; this only stops the page from listing them."
        next="Try again in a moment."
        action={
          <Button variant="secondary" onClick={c.refetch}>
            Read the chain again
          </Button>
        }
      />
    );
  }

  return (
    <div>
      {c.mode === "example" ? (
        <Notice tone="info" title="Example collection">
          The contracts are not deployed, so these are drawn with an example seed. They show what the renderer makes, not what anyone owns.
        </Notice>
      ) : null}
      {c.mode === "unrevealed" ? (
        <Notice tone="info" title="Not yet revealed">
          These asterisms exist and have owners, but their stars and tiers are fixed only when the seed is revealed after finalization.
        </Notice>
      ) : null}
      <div className={styles.toolbar} role="search">
        <fieldset className={styles.seg}>
          <legend className="t-label t-muted">Tier and primary mark</legend>
          <button type="button" className={styles.segBtn} aria-pressed={tier === "all"} onClick={() => setTier("all")}>
            All
          </button>
          {TIER_NAMES.map((n, t) => (
            <button
              key={n}
              type="button"
              className={styles.segBtn}
              aria-pressed={tier === t}
              disabled={!revealed}
              onClick={() => {
                setTier(t as Tier);
                setShown(PAGE);
              }}
              title={MARK_NAMES[t]}
            >
              {n}
            </button>
          ))}
        </fieldset>
        <div className={styles.row}>
          <Field label="Find by id or name" placeholder="97 or Lantern" value={query} onChange={(e) => setQuery(e.target.value.slice(0, 48))} />
          <div className={styles.filters}>
            <button type="button" className={styles.segBtn} aria-pressed={namedOnly} onClick={() => setNamedOnly((v) => !v)}>
              Named only
            </button>
            <button type="button" className={styles.segBtn} aria-pressed={desc} onClick={() => setDesc((v) => !v)}>
              {desc ? "Newest id first" : "Lowest id first"}
            </button>
          </div>
        </div>
      </div>
      <div className={styles.meta} aria-live="polite">
        <span>
          {c.loading ? "Reading the chain…" : `${filtered.length.toLocaleString("en-US")} of ${c.items.length.toLocaleString("en-US")} asterisms`}
          {revealed && c.progress < 1 ? ` · measuring ${Math.round(c.progress * 100)}%` : ""}
        </span>
        {c.mode === "example" ? <Badge tone="example">Example</Badge> : null}
      </div>
      {c.loading ? (
        <div className={styles.grid} aria-busy="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className={styles.card}>
              <Skeleton shape="square" />
              <Skeleton width="60%" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        c.items.length === 0 ? (
          <EmptyState title="No asterisms yet" action={<Link href="/launch/">Go to the launch</Link>}>
            Asterisms appear here once someone buys a token.
          </EmptyState>
        ) : (
          <EmptyState
            title="Nothing matches these filters"
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setTier("all");
                  setNamedOnly(false);
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            }
          >
            Try another tier, or clear the search.
          </EmptyState>
        )
      ) : (
        <>
          <ul className={styles.grid} role="list">
            {filtered.slice(0, shown).map((i) => (
              <li key={i.id}>
                <Card item={i} seedMode={c.mode} seed={c.seed} />
              </li>
            ))}
          </ul>
          {shown < filtered.length ? (
            <div className={styles.more}>
              <Button variant="secondary" onClick={() => setShown((s) => s + PAGE)}>
                Show {Math.min(PAGE, filtered.length - shown)} more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Card({ item, seedMode, seed }: { item: Item; seedMode: "example" | "unrevealed" | "revealed"; seed: `0x${string}` | null }) {
  const src = seedMode !== "unrevealed" && seed ? asterismUri(seed, item.id, item.name) : UNREVEALED_URI;
  const label =
    item.tier !== null ? `${seedMode === "example" ? "Example " : ""}asterism ${item.id}, ${TIER_NAMES[item.tier]}, ${item.stars} stars${item.name ? `, named ${item.name}` : ""}` : `Asterism ${item.id}, not yet revealed`;
  return (
    <Link href={`/gallery/?id=${item.id}`} className={styles.card} aria-label={label}>
      <span className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG */}
        <img src={src} alt="" width={240} height={240} loading="lazy" decoding="async" />
      </span>
      <span className={styles.cardMeta}>
        <span className="t-mono">#{item.id}</span>
        <span className="t-muted">{item.tier !== null ? `${TIER_NAMES[item.tier]} · ${item.stars}` : "Unrevealed"}</span>
      </span>
      {item.name ? <span className={styles.cardName}>{item.name}</span> : null}
    </Link>
  );
}
