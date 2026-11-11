import type { ReactNode } from "react";
import { Icon, type IconName } from "../icon/Icon";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "example";

const TONE_ICON: Record<BadgeTone, IconName | null> = {
  neutral: null,
  success: "check",
  warning: "alert",
  danger: "alert",
  info: "info",
  example: "eye",
};

export function Badge({ tone = "neutral", icon, children }: { tone?: BadgeTone; icon?: IconName; children: ReactNode }) {
  const name = icon ?? TONE_ICON[tone];
  return (
    <span className={[styles.badge, tone !== "neutral" ? styles[tone] : ""].filter(Boolean).join(" ")}>
      {name ? <Icon name={name} size={16} /> : null}
      {children}
    </span>
  );
}
