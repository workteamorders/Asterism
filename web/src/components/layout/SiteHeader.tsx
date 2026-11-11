"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { chain } from "@/lib/chain/chains";
import { isDeployed } from "@/lib/chain/deployment";
import { Badge } from "../badge/Badge";
import { Button } from "../button/Button";
import { Dialog } from "../dialog/Dialog";
import { Icon } from "../icon/Icon";
import { WalletButton } from "../wallet/WalletButton";
import styles from "./Layout.module.css";
import { NAV } from "./nav";

export function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0L13.2 10.8L24 12L13.2 13.2L12 24L10.8 13.2L0 12L10.8 10.8Z" fill="currentColor" />
    </svg>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = (href: string) => (path === href || path === href.replace(/\/$/, "") ? "page" : undefined);
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label="Asterism, home">
          <Mark />
          ASTERISM
        </Link>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(n.href)}>
              {n.label}
            </Link>
          ))}
        </nav>
        <span className={styles.spacer} />
        <span className={styles.net}>
          {chain.testnet ? <Badge tone="warning">{chain.name}</Badge> : <Badge icon="reticle">{chain.name}</Badge>}
        </span>
        {!isDeployed ? (
          <span className={styles.net}>
            <Badge tone="example">Not deployed</Badge>
          </span>
        ) : null}
        <WalletButton />
        <span className={styles.menuButton}>
          <Button variant="ghost" iconOnly icon="menu" label="Open menu" onClick={() => setOpen(true)} />
        </span>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Menu">
        <nav className={styles.drawerNav} aria-label="Main">
          {[{ href: "/", label: "Home" }, ...NAV].map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(n.href)} onClick={() => setOpen(false)}>
              {n.label}
              <Icon name="arrow-right" size={20} />
            </Link>
          ))}
        </nav>
        <div className={styles.drawerFoot}>
          <p className="t-small t-muted">
            Network: {chain.name}
            {isDeployed ? "" : " · contracts not deployed yet"}
          </p>
        </div>
      </Dialog>
    </header>
  );
}
