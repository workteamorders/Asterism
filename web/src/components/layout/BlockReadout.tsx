"use client";

import { useQuery } from "@tanstack/react-query";
import { chain } from "@/lib/chain/chains";
import { publicClient } from "@/lib/chain/client";
import styles from "./Layout.module.css";

/** A small live instrument readout: the chain's latest block. Quiet, but proof the page is reading the chain. */
export function BlockReadout() {
  const q = useQuery({
    queryKey: ["block"],
    queryFn: () => publicClient().getBlockNumber(),
    refetchInterval: 30_000,
    retry: 1,
  });
  return (
    <p className={styles.readoutLine} aria-live="off">
      <span>CHAIN {chain.id}</span>
      <span>{q.data ? `BLOCK ${q.data.toLocaleString("en-US")}` : q.isError ? "CHAIN NOT REACHABLE" : "READING CHAIN"}</span>
    </p>
  );
}
