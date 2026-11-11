import type { ReactNode } from "react";
import { Icon } from "../icon/Icon";
import styles from "./State.module.css";

/** An empty field of view: one illustration, one sentence, one action. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      <svg className={styles.art} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M32 0V8M32 56V64M0 32H8M56 32H64M28 32H36M32 28V36" stroke="currentColor" strokeWidth="1" />
      </svg>
      <h3 className={styles.title}>{title}</h3>
      {children ? <p className={styles.body}>{children}</p> : null}
      {action}
    </div>
  );
}

/** Errors always say what happened, whether funds or assets are safe, and what to do now. */
export function ErrorState({
  title,
  what,
  safety,
  next,
  action,
}: {
  title: string;
  what: ReactNode;
  safety: ReactNode;
  next: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <span className={styles.art}>
        <Icon name="alert" size={24} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      <ul className={styles.list}>
        <li>{what}</li>
        <li>{safety}</li>
        <li>{next}</li>
      </ul>
      {action}
    </div>
  );
}
