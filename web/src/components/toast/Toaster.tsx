"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../button/Button";
import { Icon, type IconName } from "../icon/Icon";
import styles from "./Toast.module.css";

type Tone = "success" | "danger" | "info" | "warning";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: ReactNode;
}
interface ToastApi {
  push: (t: Omit<Toast, "id">) => void;
}

const Ctx = createContext<ToastApi>({ push: () => {} });
const ICON: Record<Tone, IconName> = { success: "check", danger: "alert", info: "info", warning: "alert" };
const LIFETIME_MS = 5000;

export function useToast(): ToastApi {
  return useContext(Ctx);
}

function ToastItem({ t, onClose }: { t: Toast; onClose: (id: number) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useCallback(() => {
    timer.current = setTimeout(() => onClose(t.id), LIFETIME_MS);
  }, [onClose, t.id]);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => {
    start();
    return stop;
  }, [start]);
  return (
    <div className={`${styles.toast} ${styles[t.tone]}`} onMouseEnter={stop} onMouseLeave={start} onFocus={stop} onBlur={start}>
      <span className={styles.icon}>
        <Icon name={ICON[t.tone]} size={20} />
      </span>
      <p className={styles.title}>{t.title}</p>
      <Button variant="ghost" size="s" iconOnly icon="x" label="Dismiss notification" onClick={() => onClose(t.id)} />
      {t.body ? <div className={styles.body}>{t.body}</div> : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const close = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const api = useMemo<ToastApi>(
    () => ({ push: (t) => setToasts((all) => [...all.slice(-2), { ...t, id: next.current++ }]) }),
    [],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onClose={close} />
        ))}
      </div>
    </Ctx.Provider>
  );
}
