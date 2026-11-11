"use client";

import { useState } from "react";
import { useConnect, useConnectors } from "wagmi";
import { Button } from "../button/Button";
import { Dialog } from "../dialog/Dialog";
import { Icon } from "../icon/Icon";
import styles from "./Wallet.module.css";

/** Lists every wallet the browser announced (EIP-6963). This site never asks for a seed phrase or private key. */
export function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const connectors = useConnectors();
  const connect = useConnect();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const list = connectors.filter((c) => c.id !== "injected" || connectors.length === 1);

  return (
    <Dialog open={open} onClose={onClose} title="Connect a wallet">
      <div className={styles.connect}>
        {list.length === 0 ? (
          <p className="t-body t-muted">
            No browser wallet was found. Install a wallet extension that supports Robinhood Chain, then reload this page.
          </p>
        ) : (
          <ul className={styles.options} role="list">
            {list.map((c) => (
              <li key={c.uid}>
                <button
                  type="button"
                  className={styles.option}
                  aria-busy={busy === c.uid || undefined}
                  onClick={async () => {
                    setError(null);
                    setBusy(c.uid);
                    try {
                      await connect.mutateAsync({ connector: c });
                      onClose();
                    } catch (e) {
                      setError(e instanceof Error && /reject/i.test(e.message) ? "You declined the request in your wallet." : "The wallet did not connect. Try again or pick another wallet.");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {c.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs announced by the wallet
                    <img src={c.icon} alt="" width={28} height={28} className={styles.walletIcon} />
                  ) : (
                    <Icon name="wallet" size={24} />
                  )}
                  <span>{c.name === "Injected" ? "Browser wallet" : c.name}</span>
                  <Icon name="arrow-right" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <p className={styles.error} role="alert">
            <Icon name="alert" size={16} />
            {error}
          </p>
        ) : null}
        <p className="t-small t-muted">
          Connecting shares your public address with this page. It never moves funds on its own: every transaction is shown
          to you and signed in your wallet.
        </p>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
