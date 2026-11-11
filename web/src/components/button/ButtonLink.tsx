import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../icon/Icon";
import styles from "./Button.module.css";

/** A navigation link that looks like a button. Links navigate; buttons act. */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "m",
  iconAfter,
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "s" | "m" | "l";
  iconAfter?: IconName;
  external?: boolean;
}) {
  const cls = [styles.button, styles[variant], size !== "m" ? styles[size] : ""].filter(Boolean).join(" ");
  const inner = (
    <span className={styles.label}>
      {children}
      {iconAfter ? <Icon name={iconAfter} size={size === "l" ? 24 : 20} /> : null}
    </span>
  );
  return external ? (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
