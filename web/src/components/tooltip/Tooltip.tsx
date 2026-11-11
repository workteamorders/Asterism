import { useId, type ReactNode } from "react";
import { Icon } from "../icon/Icon";
import styles from "./Tooltip.module.css";

/** Extra context on hover and focus. Never the only place important information appears. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-describedby={id} aria-label={label}>
        <Icon name="info" size={16} />
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        {children}
      </span>
    </span>
  );
}
