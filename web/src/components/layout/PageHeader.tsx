import type { ReactNode } from "react";
import styles from "./Layout.module.css";

export function PageHeader({ index, title, lead, children }: { index: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className={styles.pageHead}>
      <span className={styles.index}>{index}</span>
      <h1 className="t-h1">{title}</h1>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
      {children}
    </header>
  );
}

export function Main({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main id="main" className={`${styles.main} ${className}`} tabIndex={-1}>
      {children}
    </main>
  );
}
