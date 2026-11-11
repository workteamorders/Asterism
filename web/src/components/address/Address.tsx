"use client";

import { useState } from "react";
import { explorerUrl } from "@/lib/chain/chains";
import { shortAddress } from "@/lib/format";
import { Icon } from "../icon/Icon";
import styles from "./Address.module.css";

/** An address or tx hash with an explorer link (when the chain has one) and a copy button. */
export function Address({ value, kind = "address", full = false, label }: { value: string; kind?: "address" | "tx"; full?: boolean; label?: string }) {
  const [copied, setCopied] = useState(false);
  const href = explorerUrl(kind, value);
  const text = full ? value : shortAddress(value);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className={styles.addr}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label ?? text} on the explorer (opens in a new tab)`}>
          <span className={full ? styles.full : undefined}>{text}</span>
          <Icon name="external" size={16} />
        </a>
      ) : (
        <span className={full ? styles.full : undefined}>{text}</span>
      )}
      <button type="button" className={styles.copy} onClick={copy} aria-label={copied ? "Copied" : `Copy ${label ?? kind}`}>
        <Icon name={copied ? "check" : "copy"} size={16} />
      </button>
    </span>
  );
}
