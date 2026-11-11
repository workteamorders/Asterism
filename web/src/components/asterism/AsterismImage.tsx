import type { ReactNode } from "react";
import styles from "./AsterismImage.module.css";

interface Props {
  src: string;
  alt: string;
  caption?: ReactNode;
  grayscale?: boolean;
  /** Rendered pixel size hint for layout; the image is fluid within its column. */
  size?: number;
}

export function AsterismImage({ src, alt, caption, grayscale, size = 400 }: Props) {
  return (
    <figure className={[styles.figure, grayscale ? styles.grayscale : ""].filter(Boolean).join(" ")}>
      <div className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG, rendered like a marketplace would */}
        <img src={src} alt={alt} width={size} height={size} decoding="async" />
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}
