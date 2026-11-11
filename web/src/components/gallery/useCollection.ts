"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { asterismFor, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { isDeployed } from "@/lib/chain/deployment";
import { readTokens, readTotalSupply } from "@/lib/chain/reads";
import { useLauncherState } from "@/lib/hooks/chain";
import { MAX_SUPPLY_TOKENS, type Guide, type Tier } from "@/lib/asterism/spec";

export interface Item {
  id: number;
  owner: Address | null;
  name: string;
  tier: Tier | null;
  stars: number | null;
  guide: Guide | null;
}

export interface Collection {
  mode: "example" | "unrevealed" | "revealed";
  seed: Hex | null;
  items: Item[];
  /** 0..1 while traits are being computed in the background. */
  progress: number;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

const NO_TRAITS = new Map<number, { tier: Tier; stars: number; guide: Guide }>();

/** Computes traits in small slices so the main thread stays responsive. */
function useTraits(seed: Hex | null, ids: number[]) {
  const [traits, setTraits] = useState<Map<number, { tier: Tier; stars: number; guide: Guide }>>(new Map());
  const [progress, setProgress] = useState(0);
  const key = `${seed}:${ids.length}:${ids[0] ?? 0}:${ids.at(-1) ?? 0}`;
  useEffect(() => {
    if (!seed) return;
    let cancelled = false;
    const out = new Map<number, { tier: Tier; stars: number; guide: Guide }>();
    let i = 0;
    let lastPaint = 0;
    // Time-budgeted slices (about 10 ms) so no task blocks input for long; each slice yields to the browser.
    const step = () => {
      if (cancelled) return;
      const until = performance.now() + 10;
      while (i < ids.length && performance.now() < until) {
        const id = ids[i++]!;
        const a = asterismFor(seed, id);
        out.set(id, { tier: a.tier, stars: a.stars.length, guide: a.guide });
      }
      const now = performance.now();
      if (now - lastPaint > 150 || i >= ids.length) {
        lastPaint = now;
        setProgress(ids.length ? i / ids.length : 1);
      }
      if (i < ids.length) setTimeout(step, 0);
      else setTraits(new Map(out));
    };
    const start = setTimeout(() => {
      setProgress(0);
      step();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures seed and ids
  }, [key]);
  // Without a seed there is nothing to measure: report an empty, finished result without touching state in the effect.
  return seed ? { traits, progress } : { traits: NO_TRAITS, progress: 1 };
}

export function useCollection(): Collection {
  const st = useLauncherState();
  const supply = useQuery({ queryKey: ["supply"], queryFn: readTotalSupply, enabled: isDeployed, refetchInterval: 30_000 });
  const maxId = supply.data ? Number(supply.data / 10n ** 18n) : 0;
  const tokens = useQuery({ queryKey: ["tokens", maxId], queryFn: () => readTokens(maxId), enabled: isDeployed && maxId > 0, staleTime: 20_000 });

  const mode: Collection["mode"] = !isDeployed ? "example" : st.data?.revealed ? "revealed" : "unrevealed";
  const seed = mode === "example" ? EXAMPLE_SEED : mode === "revealed" ? (st.data?.seed ?? null) : null;
  const records = useMemo(
    () => (mode === "example" ? Array.from({ length: MAX_SUPPLY_TOKENS }, (_, i) => ({ id: i + 1, owner: null as Address | null, name: "" })) : (tokens.data ?? [])),
    [mode, tokens.data],
  );
  const ids = useMemo(() => records.map((r) => r.id), [records]);
  const { traits, progress } = useTraits(seed, ids);
  const items: Item[] = useMemo(
    () =>
      records.map((r) => {
        const t = traits.get(r.id);
        return { id: r.id, owner: r.owner, name: r.name, tier: t?.tier ?? null, stars: t?.stars ?? null, guide: t?.guide ?? null };
      }),
    [records, traits],
  );
  return {
    mode,
    seed,
    items,
    progress,
    loading: isDeployed && (st.isLoading || supply.isLoading || (maxId > 0 && tokens.isLoading)),
    error: st.error ?? supply.error ?? tokens.error,
    refetch: () => {
      void supply.refetch();
      void tokens.refetch();
    },
  };
}
