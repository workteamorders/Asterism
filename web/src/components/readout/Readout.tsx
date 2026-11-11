import type { ReactNode } from "react";
import styles from "./Readout.module.css";

export interface ReadoutRow {
  key: string;
  value: ReactNode;
}

/** Instrument readout: label left, figure right (tabular). Stacks on narrow screens. */
export function Readout({ rows, stack = false, label }: { rows: ReadoutRow[]; stack?: boolean; label?: string }) {
  return (
    <dl className={`${styles.list} ${stack ? styles.stack : ""}`} aria-label={label}>
      {rows.map((r) => (
        <div key={r.key} className={styles.row}>
          <dt className={styles.key}>{r.key}</dt>
          <dd className={styles.val}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
