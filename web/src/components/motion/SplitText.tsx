import type { CSSProperties } from "react";
import s from "./motion.module.css";

/** Words that rise out of a mask one after another on load. The text stays one ordinary heading for readers. */
export function SplitText({ text }: { text: string }) {
  return text.split(" ").map((word, index) => (
    <span key={index}>
      <span className={s.word} style={{ "--word-order": index } as CSSProperties}>
        <span className={s.wordInner}>{word}</span>
      </span>{" "}
    </span>
  ));
}
