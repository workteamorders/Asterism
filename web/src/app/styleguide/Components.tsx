"use client";

import { useState } from "react";
import { Address } from "@/components/address/Address";
import { Badge } from "@/components/badge/Badge";
import { Button } from "@/components/button/Button";
import { Dialog } from "@/components/dialog/Dialog";
import { Icon } from "@/components/icon/Icon";
import { Meter } from "@/components/meter/Meter";
import { Notice } from "@/components/notice/Notice";
import { Readout } from "@/components/readout/Readout";
import { Skeleton } from "@/components/skeleton/Skeleton";
import { EmptyState, ErrorState } from "@/components/state/States";
import { Tabs } from "@/components/tabs/Tabs";
import { useToast } from "@/components/toast/Toaster";
import tx from "@/components/tx/TxFlow.module.css";
import { Tooltip } from "@/components/tooltip/Tooltip";
import s from "./styleguide.module.css";

const ADDRESS_EXAMPLE = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const HASH_EXAMPLE = "0x4f2a9d3c1b7e8a05c6d9f1e2b3a4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6";

const TX_ROWS = [
  { key: "Buy", value: "2 tokens" },
  { key: "Price", value: "0.002 ETH each" },
  { key: "Total", value: "0.004 ETH" },
  { key: "Network fee (estimate)", value: "0.00004 ETH" },
];

function Status({ on, bad, children }: { on?: boolean; bad?: boolean; children: string }) {
  return (
    <p className={tx.sim}>
      <span className={[tx.dot, on ? tx.dotOn : "", bad ? tx.dotBad : ""].join(" ")} aria-hidden="true" />
      {children}
    </p>
  );
}

/** Static renderings of each transaction phase, using the same classes and wording as the live flow (components/tx/TxFlow.tsx). */
function TxPhases() {
  const fee = (v: string) => [...TX_ROWS, { key: "Network fee (estimate)", value: v }];
  return (
    <div className={s.phases}>
      <div className={s.phase}>
        <span className="t-label t-muted">1 Simulating</span>
        <Readout rows={fee("…")} label="Transaction summary" />
        <Status>Simulating on-chain</Status>
        <Button variant="primary" loading loadingLabel="Simulating">
          Buy 2 tokens
        </Button>
      </div>
      <div className={s.phase}>
        <span className="t-label t-muted">2 Ready to sign</span>
        <Readout rows={fee("0.00004 ETH")} label="Transaction summary" />
        <Status on>Simulation passed: ready to sign</Status>
        <Button variant="primary">Buy 2 tokens</Button>
      </div>
      <div className={s.phase}>
        <span className="t-label t-muted">3 Blocked by simulation</span>
        <Readout rows={fee("…")} label="Transaction summary" />
        <Status bad>Simulation failed: nothing to sign</Status>
        <Notice tone="danger" title="Over the wallet limit">
          This would pass the per-wallet limit of 10 tokens. No transaction was sent and nothing left your wallet.
        </Notice>
      </div>
      <div className={s.phase}>
        <span className="t-label t-muted">4 Waiting for your wallet</span>
        <Readout rows={fee("0.00004 ETH")} label="Transaction summary" />
        <Status on>Confirm in your wallet</Status>
        <Button variant="primary" loading loadingLabel="Waiting for your wallet">
          Buy 2 tokens
        </Button>
      </div>
      <div className={s.phase}>
        <span className="t-label t-muted">5 Submitted</span>
        <Status on>Submitted, waiting for the chain</Status>
        <div className={tx.proof}>
          <span className="t-label t-muted">Submitted</span>
          <Address value={HASH_EXAMPLE} kind="tx" label="transaction" />
        </div>
      </div>
      <div className={s.phase}>
        <span className="t-label t-muted">6 Confirmed with proof</span>
        <Status on>Confirmed</Status>
        <div className={tx.proof}>
          <span className={tx.locked}>
            <Icon name="reticle" size={24} />
            Confirmed in block 1,234,567
          </span>
          <Address value={HASH_EXAMPLE} kind="tx" label="transaction" />
        </div>
      </div>
      <div className={s.phase}>
        <span className="t-label t-muted">7 Rejected in the wallet</span>
        <Status>Not completed</Status>
        <Notice tone="info" title="You rejected the request">
          Nothing was sent.
        </Notice>
      </div>
      <div className={s.phase}>
        <span className="t-label t-muted">8 Failed on chain</span>
        <Status>Not completed</Status>
        <Notice tone="danger" title="The transaction failed">
          The chain rejected it. Check the transaction on the explorer before trying again.
        </Notice>
      </div>
    </div>
  );
}

export function Components() {
  const toast = useToast();
  const [open, setOpen] = useState<"plain" | "locked" | "danger" | null>(null);
  return (
    <>
      <div className={s.sub}>
        <h3 className={s.subTitle}>Dialog: bottom sheet on a phone, centred on larger screens</h3>
        <div className={s.row}>
          <Button variant="secondary" onClick={() => setOpen("plain")}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen("locked")}>
            Open locked dialog
          </Button>
          <Button variant="danger" onClick={() => setOpen("danger")}>
            Open destructive dialog
          </Button>
        </div>
        <p className={s.note}>Escape and the backdrop close a plain dialog. A locked dialog (a transaction in progress) ignores both. Focus returns to the button that opened it.</p>
        <Dialog
          open={open === "plain"}
          onClose={() => setOpen(null)}
          title="Dialog title"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setOpen(null)}>
                Confirm
              </Button>
            </>
          }
        >
          <p>Body copy states exactly what will happen and what it costs, then the two actions.</p>
        </Dialog>
        <Dialog
          open={open === "locked"}
          onClose={() => setOpen(null)}
          locked
          title="Waiting for your wallet"
          footer={
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Close the demo
            </Button>
          }
        >
          <p>This dialog cannot be dismissed with Escape or by clicking outside. The demo button closes it.</p>
        </Dialog>
        <Dialog
          open={open === "danger"}
          onClose={() => setOpen(null)}
          title="Send part of a token?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setOpen(null)}>
                Send anyway
              </Button>
            </>
          }
        >
          <p>1 asterism would leave this wallet, and one more would be burned. This cannot be undone.</p>
        </Dialog>
      </div>

      <div className={s.sub}>
        <h3 className={s.subTitle}>Toast: four tones, announced politely, never the only record of a transaction</h3>
        <div className={s.row}>
          <Button variant="secondary" onClick={() => toast.push({ tone: "success", title: "Name saved", body: "Confirmed on chain." })}>
            Success
          </Button>
          <Button variant="secondary" onClick={() => toast.push({ tone: "info", title: "Copied", body: "Address copied to the clipboard." })}>
            Info
          </Button>
          <Button variant="secondary" onClick={() => toast.push({ tone: "warning", title: "Wrong network", body: "Switch networks in your wallet." })}>
            Warning
          </Button>
          <Button variant="secondary" onClick={() => toast.push({ tone: "danger", title: "Request rejected", body: "You rejected it in your wallet. Nothing was sent." })}>
            Danger
          </Button>
        </div>
      </div>

      <div className={s.sub}>
        <h3 className={s.subTitle}>Skeleton: reserves the size of what is loading</h3>
        <div className={s.skeletons}>
          <Skeleton width="12rem" />
          <div style={{ maxWidth: "8rem" }}>
            <Skeleton shape="square" />
          </div>
          <Skeleton shape="block" />
        </div>
      </div>

      <div className={s.sub}>
        <h3 className={s.subTitle}>Empty and error states</h3>
        <div className={s.pair}>
          <EmptyState title="This wallet holds no asterism" action={<Button variant="secondary">Go to the launch</Button>}>
            An asterism appears for every whole token you hold.
          </EmptyState>
          <ErrorState
            title="The gallery could not be read"
            what="The read-only connection to Robinhood Chain did not answer."
            safety="No asset is affected; this only stops the page from listing them."
            next="Try again in a moment."
            action={<Button variant="secondary">Read the chain again</Button>}
          />
        </div>
      </div>

      <div className={s.sub}>
        <h3 className={s.subTitle}>Meter, tooltip, tabs, address, readout</h3>
        <div className={s.pair}>
          <div className={s.stackBlock}>
            <Meter label="Sold" value={642} max={1333} valueText="642 of 1,333 tokens (48.2%)" />
            <Meter label="Sold" value={0} max={1333} valueText="0 of 1,333 tokens (0%)" />
            <Meter label="Sold" value={1333} max={1333} valueText="1,333 of 1,333 tokens (100%)" />
            <div className={s.row}>
              <Tooltip label="Tier is read from the star count and the primary mark.">
                <Badge tone="neutral">Tier</Badge>
              </Tooltip>
              <Badge tone="example">Example</Badge>
            </div>
            <Address value={ADDRESS_EXAMPLE} />
            <Address value={ADDRESS_EXAMPLE} full />
          </div>
          <div className={s.stackBlock}>
            <Tabs
              label="Example tabs"
              items={[
                { id: "a", label: "Name", content: <p className="t-small t-muted">Arrow keys move between tabs. Home and End jump to the first and last.</p> },
                { id: "b", label: "Send", content: <p className="t-small t-muted">Each panel is reachable with Tab after its tab list.</p> },
              ]}
            />
            <Readout rows={[{ key: "Price per token", value: "0.002 ETH" }, { key: "Raised", value: "0.03 ETH" }, { key: "Purchases", value: "3" }]} />
          </div>
        </div>
      </div>

      <div className={s.sub}>
        <h3 className={s.subTitle}>Wallet button states</h3>
        <div className={s.row}>
          <Button variant="secondary" size="s" icon="wallet">
            Connect wallet
          </Button>
          <Button variant="secondary" size="s" icon="wallet" loading loadingLabel="Connecting">
            Connect wallet
          </Button>
          <Button variant="secondary" size="s" icon="alert">
            Switch to Robinhood Chain
          </Button>
          <Button variant="secondary" size="s">
            0x3C44…93BC
          </Button>
        </div>
        <p className={s.note}>Not connected, connecting, wrong network, connected. The real control lives in the header and uses the same visuals.</p>
      </div>

      <div className={s.sub}>
        <h3 className={s.subTitle}>Transaction flow: every phase, in order</h3>
        <TxPhases />
      </div>
    </>
  );
}
