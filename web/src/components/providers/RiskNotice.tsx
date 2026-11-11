"use client";

import Link from "next/link";
import { useState } from "react";
import { AUDIT_REPORT_URL } from "@/lib/env";
import { Button } from "../button/Button";
import { Dialog } from "../dialog/Dialog";
import styles from "./RiskNotice.module.css";

/** Shown once, before the first purchase. Plain language; links to the full Risk page. */
export function RiskNotice({ open, onAccept, onCancel }: { open: boolean; onAccept: () => void; onCancel: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Before your first purchase"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Not now
          </Button>
          <Button variant="primary" disabled={!checked} onClick={onAccept}>
            I understand, continue
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <ul className={styles.list}>
          <li>An asterism is a digital collectible. It is not an investment and nothing here promises a return.</li>
          <li>Prices on the open market can fall to zero. Only spend what you can afford to lose entirely.</li>
          <li>Transactions on Robinhood Chain cannot be reversed. Contracts cannot be changed or paused by anyone.</li>
          <li>Holding less than one whole token burns the asterism it carried. Tiers stay hidden until the reveal.</li>
          <li>{AUDIT_REPORT_URL ? "An external audit report is published on the Rules page. An audit does not remove risk." : "The contracts have no external audit yet."} Read the risks in full before you continue.</li>
        </ul>
        <p className="t-small t-muted">
          <Link href="/risk">Read the full risk notice</Link>
        </p>
        <label className={styles.check}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>I have read this and I accept these risks.</span>
        </label>
      </div>
    </Dialog>
  );
}
