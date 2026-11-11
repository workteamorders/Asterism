import styles from "./Skeleton.module.css";

/** Placeholder shaped like the content it stands in for. Decorative: pair with an aria-busy region. */
export function Skeleton({ shape = "line", width, className }: { shape?: "line" | "square" | "block"; width?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={[styles.block, shape === "line" ? styles.line : shape === "square" ? styles.square : styles.tall, className ?? ""].join(" ")}
      style={width ? { width } : undefined}
    />
  );
}
