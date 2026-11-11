"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { Field } from "../field/Field";
import { Notice } from "../notice/Notice";
import styles from "./Observatory.module.css";

/** Shows what an ERC-20 transfer of part of a token would do to your asterisms, before you make it elsewhere. */
export function FractionCheck({ balance }: { balance: bigint }) {
  const [raw, setRaw] = useState("");
  let parsed: bigint | null = null;
  try {
    parsed = raw ? parseEther(raw) : null;
  } catch {
    parsed = null;
  }
  const unit = 10n ** 18n;
  const valid = parsed !== null && parsed > 0n && parsed <= balance;
  const before = balance / unit;
  const after = valid ? (balance - parsed!) / unit : before;
  const burned = before - after;
  const fractional = valid && parsed! % unit !== 0n;
  return (
    <section className={`${styles.panel} ${styles.fraction}`} data-inspection aria-labelledby="fraction-title">
      <h2 className="t-h4" id="fraction-title">
        Check a token transfer
      </h2>
      <p className="t-small t-muted">
        Wallets and exchanges move this collection as an ERC-20 token. Sending part of a token can burn an asterism. Check an amount here;
        nothing is sent.
      </p>
      <Field
        label="Amount you plan to send"
        inputMode="decimal"
        mono
        value={raw}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
        suffix="tokens"
        error={raw && !valid ? `Enter an amount up to your balance of ${formatEther(balance)}.` : undefined}
      />
      {valid ? (
        <Notice tone={burned > 0n && fractional ? "warning" : burned > 0n ? "info" : "success"} title={burned > 0n ? `${burned} asterism${burned === 1n ? "" : "s"} would leave this wallet` : "No asterism would leave this wallet"}>
          {fractional
            ? "This is part of a token. Asterisms follow whole tokens, so a fraction can burn one here and mint a different one for the receiver once they reach a whole token."
            : "Whole-token amounts move asterisms directly when possible."}{" "}
          You would keep {after.toString()} asterism{after === 1n ? "" : "s"}.
        </Notice>
      ) : null}
    </section>
  );
}
