"use client";

import { formatEther } from "viem";
import { useLauncherConfig, useLauncherState } from "@/lib/hooks/chain";
import { EXAMPLE_PARAMS, isDeployed } from "@/lib/chain/deployment";
import { formatInt, formatUtc } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { Badge } from "../badge/Badge";
import { Meter } from "../meter/Meter";
import { Readout } from "../readout/Readout";
import { Skeleton } from "../skeleton/Skeleton";
import styles from "./Home.module.css";

/** The proof above the fold: what the chain says right now, or plainly that nothing is deployed. */
export function LiveReadout() {
  const cfg = useLauncherConfig();
  const st = useLauncherState();
  if (!isDeployed) {
    return (
      <section className={styles.live} data-inspection aria-label="Launch status">
        <div className={styles.liveHead}>
          <span className="t-label">Launch status</span>
          <Badge tone="example">Not deployed</Badge>
        </div>
        <p className="t-small t-muted">
          No contract is deployed yet, so nothing can be bought. The figures below are the published defaults, not live data.
        </p>
        <Readout
          rows={[
            { key: "Total supply", value: `${formatInt(EXAMPLE_PARAMS.maxSupplyTokens)} tokens` },
            { key: "Sold in the launch", value: `up to ${formatInt(EXAMPLE_PARAMS.saleCap)}` },
            { key: "Price", value: "Set at deployment" },
          ]}
        />
      </section>
    );
  }
  if (st.isError || cfg.isError) {
    return (
      <section className={styles.live} data-inspection aria-label="Launch status">
        <span className="t-label">Launch status</span>
        <p className="t-small t-muted">The chain could not be read right now. Nothing is affected; try again in a moment.</p>
      </section>
    );
  }
  if (!st.data || !cfg.data) {
    return (
      <section className={styles.live} data-inspection aria-label="Launch status" aria-busy="true">
        <Skeleton width="40%" />
        <Skeleton shape="block" className="" />
        <Skeleton width="70%" />
      </section>
    );
  }
  const s = st.data;
  const c = cfg.data;
  return (
    <section className={styles.live} data-inspection aria-label="Launch status">
      <div className={styles.liveHead}>
        <span className="t-label">Launch status</span>
        <Badge tone={s.status === "Sale" ? "success" : s.status === "Refunding" ? "warning" : "neutral"}>{statusLabel(s.status)}</Badge>
      </div>
      <Meter label="Sold" value={Number(s.sold)} max={Number(s.saleCap)} />
      <Readout
        rows={[
          { key: "Price per token", value: `${formatEther(c.mintPrice)} ETH` },
          { key: "Sale opens", value: formatUtc(c.saleStart) },
          { key: "Sale closes", value: formatUtc(c.saleEnd) },
        ]}
      />
    </section>
  );
}
