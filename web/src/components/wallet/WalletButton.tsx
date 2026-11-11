"use client";

import { useState } from "react";
import { chain } from "@/lib/chain/chains";
import { shortAddress } from "@/lib/format";
import { Address } from "../address/Address";
import { Button } from "../button/Button";
import { Dialog } from "../dialog/Dialog";
import styles from "./Wallet.module.css";
import { useWallet } from "./useWallet";

export function WalletButton({ size = "s" }: { size?: "s" | "m" }) {
  const w = useWallet();
  const [menu, setMenu] = useState(false);
  if (!w.address) {
    return (
      <Button variant="secondary" size={size} icon="wallet" onClick={w.connect} loading={w.status === "connecting" || w.status === "reconnecting"} loadingLabel="Connecting">
        Connect wallet
      </Button>
    );
  }
  if (w.wrongChain) {
    return (
      <Button variant="secondary" size={size} icon="alert" onClick={() => w.switchChain().catch(() => {})} loading={w.switching} loadingLabel="Switching network">
        Switch to {chain.name}
      </Button>
    );
  }
  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setMenu(true)} aria-haspopup="dialog">
        <span className={styles.chip}>
          <span className={styles.dot} aria-hidden="true" />
          <span className="t-mono">{shortAddress(w.address)}</span>
        </span>
      </Button>
      <Dialog open={menu} onClose={() => setMenu(false)} title="Your wallet">
        <div className={styles.menu}>
          <p className="t-small t-muted">
            Connected with {w.connectorName ?? "a browser wallet"} on {chain.name}.
          </p>
          <Address value={w.address} full label="your address" />
          <Button
            variant="secondary"
            onClick={() => {
              w.disconnect();
              setMenu(false);
            }}
          >
            Disconnect wallet
          </Button>
        </div>
      </Dialog>
    </>
  );
}
