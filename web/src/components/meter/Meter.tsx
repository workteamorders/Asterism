import styles from "./Meter.module.css";

/** Sale progress: a measured bar with a text equivalent for assistive technology. */
export function Meter({ label, value, max, valueText }: { label: string; value: number; max: number; valueText: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className={styles.meter}>
      <div className={styles.labels}>
        <span className="t-label t-muted">{label}</span>
        <span className={styles.value}>{valueText}</span>
      </div>
      <div className={styles.track} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}>
        <span className={styles.fill} style={{ transform: `scaleX(${ratio})` }} />
        <span className={styles.ticks} aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} />
          ))}
        </span>
      </div>
    </div>
  );
}
