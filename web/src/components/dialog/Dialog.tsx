"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../button/Button";
import styles from "./Dialog.module.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Prevent closing (for example while waiting for a wallet signature). */
  locked?: boolean;
}

/**
 * Native <dialog> in modal mode: the browser traps focus, makes the page inert and closes on Esc.
 * Focus returns to the element that opened it. Page scroll is locked while open. Bottom sheet on phones.
 */
export function Dialog({ open, onClose, title, children, footer, locked = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.showModal();
      document.documentElement.dataset.scrollLock = "true";
    } else if (!open && el.open) {
      el.close();
    }
    return () => {
      delete document.documentElement.dataset.scrollLock;
    };
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      if (!locked) onClose();
    };
    const onClosed = () => {
      delete document.documentElement.dataset.scrollLock;
      opener.current?.focus();
    };
    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", onClosed);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("close", onClosed);
    };
  }, [locked, onClose]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
    >
      {open ? (
        <>
          <div className={styles.head}>
            <h2 className={styles.title} id={titleId}>
              {title}
            </h2>
            <Button variant="ghost" size="s" iconOnly icon="x" label="Close dialog" onClick={onClose} disabled={locked} />
          </div>
          <div className={styles.body}>{children}</div>
          {footer ? <div className={styles.foot}>{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}
