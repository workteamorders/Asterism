"use client";

import { useState } from "react";
import { formatEther, type Address } from "viem";
import { launcherAbi } from "@/lib/chain/abis";
import { simulateWrite } from "@/lib/chain/tx";
import { deployment } from "@/lib/chain/deployment";
import type { LauncherConfig, LauncherState, UserState } from "@/lib/chain/reads";
import { formatEth, formatUtc, shortAddress } from "@/lib/format";
import { Button } from "../button/Button";
import { Field } from "../field/Field";
import { useGates } from "../providers/Providers";
import { useTxFlow } from "../tx/TxFlow";
import { useWallet } from "../wallet/useWallet";
import styles from "./Launch.module.css";

export function BuyForm({ cfg, state, user }: { cfg: LauncherConfig; state: LauncherState; user: UserState | undefined }) {
  const wallet = useWallet();
  const { needRisk } = useGates();
  const tx = useTxFlow();
  const [raw, setRaw] = useState("1");
  const [touched, setTouched] = useState(false);
  const maxNow = user ? Number(user.remaining) : Number(cfg.txCap);
  const n = Number(raw);
  const valid = Number.isInteger(n) && n >= 1 && n <= Math.max(maxNow, 0);
  const error =
    touched && !valid
      ? maxNow <= 0
        ? "This wallet cannot buy more right now: its limit is reached or the sale is full."
        : `Enter a whole number from 1 to ${maxNow}.`
      : undefined;
  const cost = valid ? BigInt(n) * cfg.mintPrice : 0n;
  const finalizeBy = cfg.saleEnd + cfg.finalizeWindow;
  const launcher = deployment.addresses!.launcher;

  const review = () => {
    setTouched(true);
    if (!valid) return;
    needRisk(() =>
      tx.run({
        title: "Review purchase",
        confirmLabel: `Buy ${n} ${n === 1 ? "token" : "tokens"}`,
        successTitle: `${n} ${n === 1 ? "token" : "tokens"} bought`,
        summary: [
          { key: "Tokens", value: `${n}` },
          { key: "Asterisms minted to you", value: `${n} (unrevealed)` },
          { key: "Price per token", value: `${formatEther(cfg.mintPrice)} ETH` },
          { key: "Total price", value: `${formatEth(cost, 8)} ETH` },
          { key: "Wallet limit after this", value: `${Number(user?.purchased ?? 0n) + n} of ${cfg.walletCap}` },
          { key: "Treasury address", value: shortAddress(cfg.treasury) },
        ],
        notes: [
          "Tiers and art stay hidden until the reveal. Nobody can choose which asterism you get.",
          `At finalization about ${Number(cfg.liquidityProceedsBps) / 100}% of the proceeds become pool liquidity that can never be withdrawn; the rest goes to the treasury address above.`,
          `Your tokens cannot be transferred until the launch is finalized. If it is not finalized by ${formatUtc(finalizeBy)}, you can refund exactly ${formatEth(cost, 8)} ETH.`,
          "Later, if your balance drops below a whole token, the asterism that token carried is burned.",
        ],
        simulate: (account: Address) =>
          simulateWrite({ address: launcher, abi: launcherAbi, functionName: "buy", args: [BigInt(n)], value: cost }, account),
      }),
    );
  };

  if (!wallet.address) {
    return (
      <div className={styles.form}>
        <p className={styles.text}>Connect a wallet to buy. Browsing needs no wallet.</p>
        <Button variant="primary" icon="wallet" onClick={wallet.connect}>
          Connect wallet
        </Button>
      </div>
    );
  }
  if (wallet.wrongChain) {
    return (
      <div className={styles.form}>
        <p className={styles.text}>Your wallet is on another network.</p>
        <Button variant="primary" onClick={() => wallet.switchChain().catch(() => {})} loading={wallet.switching}>
          Switch network
        </Button>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        review();
      }}
    >
      <Field
        label="Tokens to buy"
        inputMode="numeric"
        pattern="[0-9]*"
        mono
        value={raw}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
        onBlur={() => setTouched(true)}
        suffix={`of ${Math.max(maxNow, 0)} now`}
        error={error}
        help={`Whole tokens only. Up to ${cfg.txCap} per transaction and ${cfg.walletCap} per wallet. One token carries one asterism.`}
      />
      <div className={styles.stepper}>
        <Button variant="secondary" iconOnly icon="minus" label="One fewer token" onClick={() => setRaw(String(Math.max(1, (Number(raw) || 1) - 1)))} />
        <Button variant="secondary" iconOnly icon="plus" label="One more token" onClick={() => setRaw(String(Math.min(Math.max(maxNow, 1), (Number(raw) || 0) + 1)))} />
        <Button variant="ghost" onClick={() => setRaw(String(Math.max(maxNow, 1)))}>
          Maximum
        </Button>
      </div>
      <div className={styles.total} aria-live="polite">
        <span className="t-label t-muted">Total</span>
        <span className={styles.totalValue}>{formatEth(cost, 8)} ETH</span>
      </div>
      <Button variant="primary" size="l" type="submit" iconAfter="arrow-right">
        Review purchase
      </Button>
      <p className="t-small t-muted">
        {state.sold.toString()} of {state.saleCap.toString()} sold. Nothing is sent until you confirm in your wallet.
      </p>
      {tx.dialog}
    </form>
  );
}
