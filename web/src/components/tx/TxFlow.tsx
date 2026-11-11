"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, type ReactNode } from "react";
import type { Address, Hash, TransactionReceipt, WalletClient } from "viem";
import { chain } from "@/lib/chain/chains";
import { publicClient } from "@/lib/chain/client";
import { estimateFee, type WriteRequest } from "@/lib/chain/tx";
import { explain, type Explained } from "@/lib/chain/errors";
import { formatEth } from "@/lib/format";
import { Address as AddressView } from "../address/Address";
import { Button } from "../button/Button";
import { Dialog } from "../dialog/Dialog";
import { Icon } from "../icon/Icon";
import { Notice } from "../notice/Notice";
import { Readout, type ReadoutRow } from "../readout/Readout";
import { useToast } from "../toast/Toaster";
import { useWallet } from "../wallet/useWallet";
import styles from "./TxFlow.module.css";

type WalletWrite = Parameters<WalletClient["writeContract"]>[0];

export interface TxPlan {
  title: string;
  /** Verb + object, e.g. "Buy 2 tokens". */
  confirmLabel: string;
  summary: ReadoutRow[];
  notes?: ReactNode[];
  danger?: boolean;
  successTitle: string;
  /** Simulate the call for `account` (eth_call). Throws if it would revert. */
  simulate: (account: Address) => Promise<WriteRequest>;
}

type Phase =
  | { kind: "simulating" }
  | { kind: "ready"; request: WriteRequest; fee: bigint | null }
  | { kind: "blocked"; error: Explained }
  | { kind: "signing"; request: WriteRequest; fee: bigint | null }
  | { kind: "pending"; hash: Hash }
  | { kind: "confirmed"; receipt: TransactionReceipt }
  | { kind: "failed"; error: Explained; hash?: Hash };

/** Every transaction: simulate first, show the full summary and the gas estimate, then sign, then show proof. */
export function useTxFlow() {
  const wallet = useWallet();
  const toast = useToast();
  const qc = useQueryClient();
  const [plan, setPlan] = useState<TxPlan | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "simulating" });

  const run = useCallback(
    async (p: TxPlan) => {
      if (!wallet.address) return;
      setPlan(p);
      setPhase({ kind: "simulating" });
      try {
        const request = await p.simulate(wallet.address);
        const fee = await estimateFee(request, wallet.address);
        setPhase({ kind: "ready", request, fee });
      } catch (e) {
        setPhase({ kind: "blocked", error: explain(e, "simulate") });
      }
    },
    [wallet.address],
  );

  const confirm = useCallback(async () => {
    if (phase.kind !== "ready" || !wallet.walletClient || !plan) return;
    setPhase({ kind: "signing", request: phase.request, fee: phase.fee });
    let hash: Hash | undefined;
    try {
      hash = await wallet.walletClient.writeContract({ ...phase.request, account: wallet.address ?? null, chain } as unknown as WalletWrite);
      setPhase({ kind: "pending", hash });
      const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (receipt.status !== "success") {
        setPhase({ kind: "failed", hash, error: { title: "Transaction reverted", detail: "The chain rejected it. Only the gas fee was spent.", fundsMoved: false, rejected: false } });
        return;
      }
      setPhase({ kind: "confirmed", receipt });
      toast.push({ tone: "success", title: plan.successTitle, body: "Confirmed on-chain. The proof stays in the dialog." });
      await qc.invalidateQueries();
    } catch (e) {
      const err = explain(e, hash ? "confirm" : "sign");
      setPhase({ kind: "failed", error: err, hash });
      if (!err.rejected) toast.push({ tone: "danger", title: err.title, body: err.detail });
    }
  }, [phase, plan, qc, toast, wallet.address, wallet.walletClient]);

  const close = useCallback(() => setPlan(null), []);
  const busy = phase.kind === "signing" || phase.kind === "pending";

  const dialog = plan ? (
    <Dialog
      open
      onClose={close}
      locked={busy}
      title={plan.title}
      footer={
        phase.kind === "confirmed" ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            {phase.kind === "failed" && !phase.hash ? (
              <Button variant="secondary" icon="reticle" onClick={() => run(plan)}>
                Simulate again
              </Button>
            ) : null}
            <Button
              variant={plan.danger ? "danger" : "primary"}
              icon={plan.danger ? "alert" : undefined}
              onClick={confirm}
              disabled={phase.kind !== "ready" && !busy}
              loading={busy || phase.kind === "simulating"}
              loadingLabel={phase.kind === "pending" ? "Waiting for confirmation" : phase.kind === "signing" ? "Waiting for your wallet" : "Simulating"}
            >
              {plan.confirmLabel}
            </Button>
          </>
        )
      }
    >
      <div className={styles.flow}>
        <Readout
          rows={[
            ...plan.summary,
            {
              key: "Network fee (estimate)",
              value:
                phase.kind === "ready" || phase.kind === "signing"
                  ? phase.fee !== null
                    ? `${formatEth(phase.fee, 8)} ETH`
                    : "Unavailable"
                  : "…",
            },
          ]}
          label="Transaction summary"
        />
        {plan.notes?.length ? (
          <ul className={styles.notes}>
            {plan.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : null}
        <p className={styles.sim} aria-live="polite">
          <span
            className={[styles.dot, phase.kind === "ready" || busy || phase.kind === "confirmed" ? styles.dotOn : "", phase.kind === "blocked" ? styles.dotBad : ""].join(" ")}
            aria-hidden="true"
          />
          {phase.kind === "simulating"
            ? "Simulating on-chain"
            : phase.kind === "blocked"
              ? "Simulation failed: nothing to sign"
              : phase.kind === "signing"
                ? "Confirm in your wallet"
                : phase.kind === "pending"
                  ? "Submitted, waiting for the chain"
                  : phase.kind === "confirmed"
                    ? "Confirmed"
                    : phase.kind === "failed"
                      ? "Not completed"
                      : "Simulation passed: ready to sign"}
        </p>
        {phase.kind === "blocked" ? (
          <Notice tone="danger" title={phase.error.title}>
            {phase.error.detail} No transaction was sent and nothing left your wallet.
          </Notice>
        ) : null}
        {phase.kind === "failed" ? (
          <Notice tone={phase.error.rejected ? "info" : "danger"} title={phase.error.title}>
            {phase.error.detail}{" "}
            {phase.hash ? "Check the transaction on the explorer before trying again." : "Nothing was sent."}
          </Notice>
        ) : null}
        {phase.kind === "pending" ? (
          <div className={styles.proof}>
            <span className="t-label t-muted">Submitted</span>
            <AddressView value={phase.hash} kind="tx" label="transaction" />
          </div>
        ) : null}
        {phase.kind === "confirmed" ? (
          <div className={styles.proof}>
            <span className={styles.locked}>
              <Icon name="reticle" size={24} />
              Confirmed in block {phase.receipt.blockNumber.toLocaleString("en-US")}
            </span>
            <AddressView value={phase.receipt.transactionHash} kind="tx" label="transaction" />
          </div>
        ) : null}
      </div>
    </Dialog>
  ) : null;

  return { run, dialog };
}
