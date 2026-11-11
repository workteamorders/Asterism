import { useId, type InputHTMLAttributes } from "react";
import { Icon } from "../icon/Icon";
import styles from "./Field.module.css";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  help?: string;
  error?: string;
  suffix?: string;
  mono?: boolean;
  /** Show "used / max" when maxLength is set. */
  count?: number;
  forceState?: "hover" | "focus";
}

export function Field({ label, help, error, suffix, mono, count, forceState, disabled, maxLength, id, className, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = help ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const classes = [styles.field, error ? styles.invalid : "", disabled ? styles.disabled : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        {maxLength !== undefined && count !== undefined ? (
          <span className={styles.counter} aria-live="polite">
            {count} / {maxLength}
          </span>
        ) : null}
      </div>
      <div className={styles.control} data-state={forceState}>
        <input
          id={inputId}
          className={[styles.input, mono ? styles.mono : ""].filter(Boolean).join(" ")}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, helpId].filter(Boolean).join(" ") || undefined}
          disabled={disabled}
          maxLength={maxLength}
          {...rest}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </div>
      {error ? (
        <p className={styles.error} id={errorId}>
          <Icon name="alert" size={16} />
          {error}
        </p>
      ) : null}
      {help ? (
        <p className={styles.help} id={helpId}>
          {help}
        </p>
      ) : null}
    </div>
  );
}
