"use client";

import { useEffect, useState } from "react";
import styles from "./Offline.module.css";

/** Appears only when the browser reports it is offline. Chain data on screen may be out of date until it returns. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className={styles.banner} role="status">
      You are offline. Figures on this page may be out of date, and nothing can be signed until you reconnect.
    </div>
  );
}
