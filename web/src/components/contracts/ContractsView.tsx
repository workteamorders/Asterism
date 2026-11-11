"use client";

import { useQuery } from "@tanstack/react-query";
import { formatEther, type Address } from "viem";
import { rendererAbi, tokenAbi } from "@/lib/chain/abis";
import { chain } from "@/lib/chain/chains";
import { deployment, isDeployed } from "@/lib/chain/deployment";
import { readMany } from "@/lib/chain/reads";
import { codeMatches, sourceVerified, type ContractName } from "@/lib/chain/verify";
import { AUDIT_REPORT_URL } from "@/lib/env";
import { formatUtc } from "@/lib/format";
import { useLauncherConfig } from "@/lib/hooks/chain";
import { Address as AddressView } from "../address/Address";
import { Badge } from "../badge/Badge";
import { Notice } from "../notice/Notice";
import { Readout } from "../readout/Readout";
import { Skeleton } from "../skeleton/Skeleton";
import { EmptyState } from "../state/States";
import styles from "./Contracts.module.css";

const ROWS: { key: keyof NonNullable<typeof deployment.addresses>; name: ContractName; label: string; role: string }[] = [
  { key: "launcher", name: "AsterismLauncher", label: "Launcher", role: "Sale, finalization, refunds, reveal" },
  { key: "token", name: "AsterismToken", label: "Token (ERC-20 side)", role: "Balances, names, transfer lock" },
  { key: "mirror", name: "DN404Mirror", label: "Mirror (ERC-721 side)", role: "NFT ownership and transfers" },
  { key: "renderer", name: "AsterismRenderer", label: "Renderer", role: "Draws the SVG and metadata, view only" },
  { key: "sink", name: "LiquiditySink", label: "Liquidity sink", role: "Holds pool tokens forever, no functions" },
];

function CodeStatus({ address, name }: { address: Address; name: ContractName }) {
  const code = useQuery({ queryKey: ["code", address], queryFn: () => codeMatches(address, name), staleTime: Infinity });
  const src = useQuery({ queryKey: ["src", address], queryFn: () => sourceVerified(address), staleTime: 300_000 });
  return (
    <span className={styles.statuses}>
      {code.isLoading ? <Skeleton width="8rem" /> : code.data ? <Badge tone="success">Code matches this build</Badge> : <Badge tone="danger">Code differs from this build</Badge>}
      {src.data === true ? <Badge tone="success">Source verified on explorer</Badge> : src.data === false ? <Badge>Source not verified on explorer</Badge> : null}
    </span>
  );
}

export function ContractsView() {
  if (!isDeployed) {
    return (
      <EmptyState title="Nothing is deployed yet">
        There are no contract addresses to show. After deployment this page lists every address, compares the code on-chain with this build,
        and reads every constant from the chain.
      </EmptyState>
    );
  }
  return <Live />;
}

function Live() {
  const a = deployment.addresses!;
  const p = deployment.params;
  const cfg = useLauncherConfig();
  const extra = useQuery({
    queryKey: ["contract-constants"],
    queryFn: async () => {
      const r = await readMany([
        { address: a.token, abi: tokenAbi, functionName: "name" },
        { address: a.token, abi: tokenAbi, functionName: "symbol" },
        { address: a.token, abi: tokenAbi, functionName: "maxSupply" },
        { address: a.renderer, abi: rendererAbi, functionName: "tierCounts" },
      ]);
      return { name: r[0] as string, symbol: r[1] as string, maxSupply: r[2] as bigint, tierCounts: r[3] as readonly bigint[] };
    },
  });
  const c = cfg.data;
  const matches = (live: string | bigint | undefined, published: string | number | undefined) =>
    live === undefined || published === undefined ? null : String(live).toLowerCase() === String(published).toLowerCase();
  const row = (key: string, live: string | bigint | undefined, published?: string | number, display?: string) => {
    const m = matches(live, published);
    return {
      key,
      value: (
        <span className={styles.constant}>
          <span>{live === undefined ? "…" : display ?? String(live)}</span>
          {m === false ? <Badge tone="danger">Differs from published</Badge> : null}
        </span>
      ),
    };
  };
  const mismatch = c && p && (String(c.mintPrice) !== p.mintPriceWei || c.treasury.toLowerCase() !== p.treasury.toLowerCase() || c.revealCommit.toLowerCase() !== p.revealCommit.toLowerCase());

  return (
    <div className={styles.stack}>
      {mismatch ? (
        <Notice tone="danger" title="On-chain values differ from the published file" role="alert">
          The chain does not match deployments/{chain.id}.json in this build. Trust the chain, and do not buy until this is explained publicly.
        </Notice>
      ) : null}
      <section className={styles.section} aria-labelledby="addr-title">
        <h2 className="t-h3" id="addr-title">Addresses</h2>
        <ul className={styles.cards} role="list">
          {ROWS.map((r) => (
            <li key={r.key} className={styles.card}>
              <span className={styles.cardHead}>
                <span className="t-h4">{r.label}</span>
                <span className="t-small t-muted">{r.role}</span>
              </span>
              <AddressView value={a[r.key]} full label={r.label} />
              <CodeStatus address={a[r.key]} name={r.name} />
            </li>
          ))}
        </ul>
        <p className="t-small t-muted">
          &ldquo;Code matches this build&rdquo; compares the bytecode on-chain with the compiled contracts shipped with this site, with constructor values
          masked. It is not an audit.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="const-title">
        <h2 className="t-h3" id="const-title">Constants, read from the chain</h2>
        <div className={styles.panel}>
          {c ? (
            <Readout
              rows={[
                row("Name / symbol", extra.data ? `${extra.data.name} / ${extra.data.symbol}` : undefined, p ? `${p.name} / ${p.symbol}` : undefined),
                row("Maximum supply", c.maxSupplyTokens, 2222, `${c.maxSupplyTokens} tokens`),
                row("Sale cap", c.saleCap, 1333, `${c.saleCap} tokens`),
                row("Price per token", c.mintPrice, p?.mintPriceWei, `${formatEther(c.mintPrice)} ETH`),
                row("Per transaction", c.txCap, p?.txCap),
                row("Per wallet", c.walletCap, p?.walletCap),
                row("Sale opens", c.saleStart, p?.saleStart, formatUtc(c.saleStart)),
                row("Sale closes", c.saleEnd, p?.saleEnd, formatUtc(c.saleEnd)),
                row("Finalization window", c.finalizeWindow, p?.finalizeWindowSeconds, `${Number(c.finalizeWindow) / 3600} hours`),
                row("Reveal window", c.revealWindow, p?.revealWindowSeconds, `${Number(c.revealWindow) / 3600} hours after finalization`),
                row("Liquidity share", c.liquidityProceedsBps, 6667, `${Number(c.liquidityProceedsBps) / 100}%`),
                row("Treasury share", c.treasuryProceedsBps, 3333, `${Number(c.treasuryProceedsBps) / 100}%`),
                row("Tier counts", extra.data?.tierCounts.join(" / "), "1200 / 600 / 300 / 100 / 22"),
                row("Reveal commitment", c.revealCommit, p?.revealCommit),
              ]}
            />
          ) : (
            <Skeleton shape="block" />
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="roles-title">
        <h2 className="t-h3" id="roles-title">Who holds which role</h2>
        <div className={styles.panel}>
          {c ? (
            <Readout
              rows={[
                { key: "Revealer (can call reveal once, nothing else)", value: <AddressView value={c.revealer} label="revealer" /> },
                { key: "Treasury (receives its share, cannot call anything special)", value: <AddressView value={c.treasury} label="treasury" /> },
                { key: "Owner or admin", value: "None" },
              ]}
            />
          ) : (
            <Skeleton shape="block" />
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="audit-title">
        <h2 className="t-h3" id="audit-title">Audit</h2>
        {AUDIT_REPORT_URL ? (
          <p>
            <a href={AUDIT_REPORT_URL} target="_blank" rel="noopener noreferrer">
              Read the external audit report
            </a>
          </p>
        ) : (
          <Notice tone="warning" title="No external audit yet">
            The contracts are tested (unit, fuzz and invariant tests) but have not been reviewed by an external auditor.
          </Notice>
        )}
        <p className="t-small t-muted">
          Check it yourself from the repository: <span className="t-mono">pnpm verify:deployment -- --chain {chain.id}</span>
        </p>
      </section>
    </div>
  );
}
