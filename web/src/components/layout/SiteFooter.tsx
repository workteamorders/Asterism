import Link from "next/link";
import { chain } from "@/lib/chain/chains";
import styles from "./Layout.module.css";
import { BlockReadout } from "./BlockReadout";
import { NAV } from "./nav";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footInner}>
        <div className={styles.cols}>
          <div className={styles.col}>
            <span className="t-label">Asterism</span>
            <p>Asterisms drawn entirely on-chain, one per whole token, on {chain.name}.</p>
          </div>
          <nav className={styles.col} aria-label="Footer">
            <span className="t-label">Pages</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className={styles.col}>
            <span className="t-label">Read first</span>
            <Link href="/risk/">Risk notice</Link>
            <Link href="/terms/">Terms of use</Link>
            <Link href="/terms/#privacy">Privacy</Link>
          </div>
          <div className={styles.col}>
            <span className="t-label">Contact</span>
            <p>Official X and Discord accounts will be listed here before the sale opens. Until then, trust no other channel.</p>
          </div>
        </div>
        <div className={styles.legal}>
          <p>A digital collectible. Not financial advice. Not affiliated with Robinhood Markets, Inc.</p>
          <BlockReadout />
        </div>
      </div>
    </footer>
  );
}
