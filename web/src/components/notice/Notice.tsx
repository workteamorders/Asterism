import type { ReactNode } from "react";
import { Icon, type IconName } from "../icon/Icon";
import styles from "./Notice.module.css";

export type NoticeTone = "success" | "warning" | "danger" | "info";

const ICON: Record<NoticeTone, IconName> = { success: "check", warning: "alert", danger: "alert", info: "info" };

export function Notice({ tone, title, children, role }: { tone: NoticeTone; title: string; children?: ReactNode; role?: "status" | "alert" }) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={role}>
      <span className={styles.icon}>
        <Icon name={ICON[tone]} size={20} />
      </span>
      <p className={styles.title}>{title}</p>
      {children ? <div className={styles.body}>{children}</div> : null}
    </div>
  );
}
