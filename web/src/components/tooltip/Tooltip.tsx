"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "../icon/Icon";
import styles from "./Tooltip.module.css";

/** Extra context on hover and focus. Never the only place important information appears. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return (
    <span
      className={styles.wrap}
      data-dismissed={dismissed || undefined}
      onPointerEnter={() => setDismissed(false)}
      onFocus={() => setDismissed(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !dismissed) {
          setDismissed(true);
          event.stopPropagation();
        }
      }}
    >
      <button type="button" className={styles.trigger} aria-describedby={id} aria-label={label}>
        <Icon name="info" size={16} />
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        {children}
      </span>
    </span>
  );
}
