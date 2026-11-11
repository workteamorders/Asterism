import type { ReactNode } from "react";
import type { Asterism } from "@/lib/asterism/geometry";
import { ConstellationTrace } from "./ConstellationTrace";
import styles from "./AsterismImage.module.css";

interface Props {
  src: string;
  geometry?: Asterism;
  alt: string;
  caption?: ReactNode;
  grayscale?: boolean;
  /** Rendered pixel size hint for layout; the image is fluid within its column. */
  size?: number;
}

export function AsterismImage({ src, alt, caption, grayscale, geometry, size = 400 }: Props) {
  return (
    <figure className={[styles.figure, grayscale ? styles.grayscale : ""].filter(Boolean).join(" ")}>
      <div className={styles.frame} data-constellation={geometry ? "" : undefined} tabIndex={geometry ? 0 : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG, rendered like a marketplace would */}
        <img src={src} alt={alt} width={size} height={size} decoding="async" />
        {geometry ? <ConstellationTrace geometry={geometry} /> : null}
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}
