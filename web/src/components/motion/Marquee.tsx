import s from "./motion.module.css";

/** A slow ticker of plain facts. The duplicate row is hidden from assistive technology; hover or focus pauses it. */
export function Marquee({ items, label }: { items: readonly string[]; label: string }) {
  const row = (hidden: boolean) => (
    <ul className={s.marqueeRow} aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={item}>
          <span className={s.marqueeMark} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <div className={s.marquee} role="region" aria-label={label} tabIndex={0}>
      <div className={s.marqueeTrack}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
