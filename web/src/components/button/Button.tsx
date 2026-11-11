import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../icon/Icon";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "s" | "m" | "l";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconAfter?: IconName;
  /** Icon-only buttons must pass `label` for assistive technology. */
  iconOnly?: boolean;
  label?: string;
  loading?: boolean;
  loadingLabel?: string;
  /** Styleguide only: render a forced visual state. */
  forceState?: "hover" | "focus" | "pressed";
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "m",
  icon,
  iconAfter,
  iconOnly = false,
  label,
  loading = false,
  loadingLabel = "Working",
  forceState,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size !== "m" ? styles[size] : "",
    iconOnly ? styles.iconOnly : "",
    loading ? styles.loading : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const iconSize = size === "l" ? 24 : 20;
  return (
    <button
      type={type}
      className={classes}
      data-state={forceState}
      data-magnet={variant === "primary" ? "" : undefined}
      aria-busy={loading || undefined}
      aria-label={iconOnly ? label : undefined}
      {...rest}
    >
      <span className={styles.label}>
        {icon ? <Icon name={icon} size={iconSize} /> : null}
        {iconOnly ? null : children}
        {iconAfter ? <Icon name={iconAfter} size={iconSize} /> : null}
      </span>
      {loading ? (
        <span className={styles.spinner}>
          <Icon name="spinner" size={iconSize} />
          <span className="sr-only">{loadingLabel}</span>
        </span>
      ) : null}
    </button>
  );
}
