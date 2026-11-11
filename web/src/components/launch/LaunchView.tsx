"use client";

import Link from "next/link";
import { formatEther, type Address } from "viem";
import { launcherAbi } from "@/lib/chain/abis";
import { simulateWrite } from "@/lib/chain/tx";
import { deployment, EXAMPLE_PARAMS, isDeployed } from "@/lib/chain/deployment";
import type { LauncherConfig, LauncherState, UserState } from "@/lib/chain/reads";
import { explain } from "@/lib/chain/errors";
import { formatEth, formatInt, formatUtc, percent, relativeTime } from "@/lib/format";
import { useLauncherConfig, useLauncherState, useUserState } from "@/lib/hooks/chain";
import { statusLabel } from "@/lib/status";
import { Address as AddressView } from "../address/Address";
import { Badge } from "../badge/Badge";
import { Button } from "../button/Button";
import { ButtonLink } from "../button/ButtonLink";
import { Meter } from "../meter/Meter";
import { Notice } from "../notice/Notice";
import { useGates } from "../providers/Providers";
import { Readout } from "../readout/Readout";
import { Skeleton } from "../skeleton/Skeleton";
import { EmptyState, ErrorState } from "../state/States";
import { useTxFlow } from "../tx/TxFlow";
import { useWallet } from "../wallet/useWallet";
import { BuyForm } from "./BuyForm";
import styles from "./Launch.module.css";

const LAUNCHER = () => deployment.addresses!.launcher;

function simulateCall(functionName: "finalizeLaunch" | "withdrawTreasury" | "refund" | "revealFallback") {
  return (account: Address) => simulateWrite({ address: LAUNCHER(), abi: launcherAbi, functionName }, account);
}

export function LaunchView() {
  if (!isDeployed) return <NotDeployed />;
  return <Deployed />;
}

function NotDeployed() {
  return (
    <div className={styles.grid}>
      <EmptyState title="The contracts are not deployed yet">
        Nothing can be bought, and no address on this page is live. When the owner deploys, the parameters will be published here
        before the sale opens, and this page will read every figure from the chain.
      </EmptyState>
      <section className={styles.panel} aria-labelledby="proposed-title">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle} id="proposed-title">
            Proposed parameters
          </h2>
          <Badge tone="example">Example</Badge>
        </div>
        <Readout
          rows={[
            { key: "Total supply", value: `${formatInt(EXAMPLE_PARAMS.maxSupplyTokens)} tokens` },
            { key: "Sold in the launch (60%)", value: `up to ${formatInt(EXAMPLE_PARAMS.saleCap)} tokens` },
            { key: "Per transaction / per wallet", value: `${EXAMPLE_PARAMS.txCap} / ${EXAMPLE_PARAMS.walletCap} tokens` },
            { key: "Proceeds to locked liquidity", value: "66.67%" },
            { key: "Proceeds to treasury", value: "33.33%" },
            { key: "Price, dates, treasury", value: "Set at deployment" },
          ]}
        />
        <p className="t-small t-muted">These defaults can still change before deployment. Once deployed, nothing can change.</p>
      </section>
    </div>
  );
}

function Deployed() {
  const cfg = useLauncherConfig();
  const st = useLauncherState();
  const wallet = useWallet();
  const user = useUserState(wallet.address);
  if (cfg.isError || st.isError) {
    const e = explain(cfg.error ?? st.error, "read");
    return (
      <ErrorState
        title="The launch could not be read"
        what={`The page could not reach the chain: ${e.detail}`}
        safety="Your funds and tokens are not affected by this; it is a display problem only."
        next="Check your connection and try again. The contract keeps running without this site."
        action={
          <Button variant="secondary" icon="reticle" onClick={() => void Promise.all([cfg.refetch(), st.refetch()])}>
            Read the chain again
          </Button>
        }
      />
    );
  }
  if (!cfg.data || !st.data) return <LaunchSkeleton />;
  return <Live cfg={cfg.data} state={st.data} user={user.data} />;
}

function LaunchSkeleton() {
  return (
    <div className={styles.grid} aria-busy="true" aria-label="Reading the launch from the chain">
      <div className={styles.panel}>
        <Skeleton width="30%" />
        <Skeleton shape="block" />
        <Skeleton width="80%" />
        <Skeleton width="60%" />
      </div>
      <div className={styles.panel}>
        <Skeleton width="40%" />
        <Skeleton width="100%" />
        <Skeleton width="50%" />
      </div>
    </div>
  );
}

function Live({ cfg, state, user }: { cfg: LauncherConfig; state: LauncherState; user: UserState | undefined }) {
  const now = Number(state.now);
  const finalizeBy = cfg.saleEnd + cfg.finalizeWindow;
  return (
    <>
      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="status-title">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle} id="status-title">
              Status
            </h2>
            <Badge tone={state.status === "Sale" ? "success" : state.status === "Refunding" ? "warning" : "neutral"}>{statusLabel(state.status)}</Badge>
          </div>
          <Meter label="Sold" value={Number(state.sold)} max={Number(state.saleCap)} valueText={`${formatInt(state.sold)} of ${formatInt(state.saleCap)} tokens (${percent(state.sold, state.saleCap)})`} />
          <Readout
            rows={[
              { key: "Price per token", value: `${formatEther(cfg.mintPrice)} ETH` },
              { key: "Raised", value: `${formatEth(state.raised)} ETH` },
              { key: "Purchases", value: formatInt(state.purchaseCount) },
              { key: "Sale opens", value: formatUtc(cfg.saleStart) },
              { key: "Sale closes", value: formatUtc(cfg.saleEnd) },
              { key: "Finalization possible until", value: formatUtc(finalizeBy) },
            ]}
          />
          <p className="t-small t-muted">Times come from the chain clock, which can differ from yours by a few minutes.</p>
        </section>
        <ActionPanel cfg={cfg} state={state} user={user} now={now} />
      </div>
      <MoneyPanel cfg={cfg} state={state} />
      {user ? <Position cfg={cfg} user={user} /> : null}
    </>
  );
}

function ActionPanel({ cfg, state, user, now }: { cfg: LauncherConfig; state: LauncherState; user: UserState | undefined; now: number }) {
  const { geo } = useGates();
  const wallet = useWallet();
  const tx = useTxFlow();
  const needWallet = (fn: () => void) => (wallet.address ? fn() : wallet.connect());
  const viewOnly = geo.viewOnly;

  let title = "";
  let body: React.ReactNode = null;
  switch (state.status) {
    case "NotStarted":
      title = "The sale has not started";
      body = (
        <p className={styles.text}>
          It opens at {formatUtc(cfg.saleStart)}, {relativeTime(cfg.saleStart, now)}. Until then nothing can be bought.
        </p>
      );
      break;
    case "Sale":
      title = "Buy";
      body = viewOnly ? null : <BuyForm cfg={cfg} state={state} user={user} />;
      break;
    case "AwaitingFinalization":
      title = "Ready to finalize";
      body = (
        <div className={styles.stack}>
          <p className={styles.text}>
            {state.sold === state.saleCap ? "The sale sold out." : "The sale has ended."} Anyone can now finalize: that opens a Uniswap V2
            pool at exactly the sale price, locks its liquidity forever, and unlocks transfers. This is possible until{" "}
            {formatUtc(cfg.saleEnd + cfg.finalizeWindow)}.
          </p>
          {state.splitTokens === 0n ? (
            <Notice tone="warning" title="Too few tokens sold to open a pool">
              At least 2 tokens must be sold. If it cannot be finalized in time, every buyer can refund in full.
            </Notice>
          ) : viewOnly ? null : (
            <Button
              variant="primary"
              onClick={() =>
                needWallet(() =>
                  tx.run({
                    title: "Finalize the launch",
                    confirmLabel: "Finalize launch",
                    successTitle: "Launch finalized",
                    summary: [
                      { key: "Tokens into the pool", value: formatInt(state.splitTokens) },
                      { key: "ETH into the pool", value: `${formatEth(state.splitWei, 8)} ETH` },
                      { key: "Opening price", value: `${formatEther(cfg.mintPrice)} ETH per token` },
                      { key: "Treasury share", value: `${formatEth(state.raised - state.splitWei, 8)} ETH` },
                    ],
                    notes: ["Liquidity tokens go to a contract with no functions. Nobody can withdraw them, ever.", "You pay only the gas fee; you receive nothing for finalizing."],
                    simulate: simulateCall("finalizeLaunch"),
                  }),
                )
              }
            >
              Review finalization
            </Button>
          )}
        </div>
      );
      break;
    case "Trading": {
      title = "Trading is open";
      const unpaid = state.treasuryAmount - state.treasuryWithdrawn;
      const canFallback = !state.revealed && now > Number(state.revealDeadline);
      body = (
        <div className={styles.stack}>
          <Readout
            rows={[
              { key: "Pool", value: <AddressView value={state.pair} label="pool" /> },
              { key: "Pool opened with", value: `${formatInt(state.tokenLP)} tokens and ${formatEth(state.ethLP)} ETH` },
              { key: "Reveal", value: state.revealed ? "Revealed" : `Pending, deadline ${formatUtc(state.revealDeadline)}` },
              { key: "Treasury share sent", value: unpaid === 0n ? "Yes" : `Not yet: ${formatEth(unpaid)} ETH` },
            ]}
          />
          {state.revealed ? (
            <ButtonLink href="/gallery/" variant="primary" iconAfter="arrow-right">
              See the asterisms
            </ButtonLink>
          ) : null}
          {!viewOnly && unpaid > 0n ? (
            <Button
              variant="secondary"
              onClick={() =>
                needWallet(() =>
                  tx.run({
                    title: "Send the treasury share",
                    confirmLabel: "Send treasury share",
                    successTitle: "Treasury share sent",
                    summary: [
                      { key: "Amount", value: `${formatEth(unpaid, 8)} ETH` },
                      { key: "Recipient (fixed)", value: <AddressView value={cfg.treasury} label="treasury" /> },
                    ],
                    notes: ["Anyone can trigger this. The ETH can only go to the fixed treasury address."],
                    simulate: simulateCall("withdrawTreasury"),
                  }),
                )
              }
            >
              Send treasury share
            </Button>
          ) : null}
          {!viewOnly && canFallback ? (
            <Button
              variant="secondary"
              onClick={() =>
                needWallet(() =>
                  tx.run({
                    title: "Fix the seed with the fallback",
                    confirmLabel: "Use fallback seed",
                    successTitle: "Seed fixed",
                    summary: [{ key: "Seed formula", value: "keccak256(entropy, commit)" }],
                    notes: ["The revealer missed the deadline. This sets the seed permanently from public data."],
                    simulate: simulateCall("revealFallback"),
                  }),
                )
              }
            >
              Use fallback seed
            </Button>
          ) : null}
        </div>
      );
      break;
    }
    case "Refunding": {
      title = "Refunds are open";
      const mine = user?.paid ?? 0n;
      body = (
        <div className={styles.stack}>
          <p className={styles.text}>
            {state.sold === 0n ? "The sale ended without purchases." : "The launch was not finalized in time."} Every buyer can burn the tokens
            they bought and get back exactly what they paid.
          </p>
          {wallet.address && mine === 0n ? <p className="t-small t-muted">This wallet has nothing to refund.</p> : null}
          {!viewOnly && (!wallet.address || mine > 0n) ? (
            <Button
              variant="primary"
              onClick={() =>
                needWallet(() =>
                  tx.run({
                    title: "Refund your purchase",
                    confirmLabel: "Refund purchase",
                    successTitle: "Refund sent",
                    summary: [
                      { key: "Tokens burned", value: formatInt(user?.purchased ?? 0n) },
                      { key: "ETH returned", value: `${formatEth(mine, 8)} ETH` },
                    ],
                    notes: ["Your tokens and their asterisms are burned. This cannot be undone."],
                    danger: true,
                    simulate: simulateCall("refund"),
                  }),
                )
              }
            >
              Review refund
            </Button>
          ) : null}
        </div>
      );
      break;
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="action-title">
      <h2 className={styles.panelTitle} id="action-title">
        {title}
      </h2>
      {viewOnly ? (
        <Notice tone="info" title="View only in your region">
          Buying, finalizing, refunds, naming and sending are turned off in this interface where you are. This is a limit of this website only:
          the contracts stay permissionless and can be used directly.
        </Notice>
      ) : null}
      {body}
      {tx.dialog}
    </section>
  );
}

function MoneyPanel({ cfg, state }: { cfg: LauncherConfig; state: LauncherState }) {
  const lp = state.finalized ? state.ethLP : state.splitWei;
  const tLP = state.finalized ? state.tokenLP : state.splitTokens;
  const treasury = state.finalized ? state.treasuryAmount : state.raised - state.splitWei;
  return (
    <section className={styles.section} aria-labelledby="money-title">
      <h2 className="t-h3" id="money-title">
        Where the money goes {state.finalized ? "" : "(if finalized now)"}
      </h2>
      <div className={styles.panel}>
        <Readout
          rows={[
            { key: "Raised", value: `${formatEth(state.raised)} ETH` },
            { key: "Into the pool, locked forever", value: `${formatEth(lp)} ETH and ${formatInt(tLP)} tokens` },
            { key: "To the treasury", value: `${formatEth(treasury)} ETH` },
            { key: "Treasury address", value: <AddressView value={cfg.treasury} label="treasury" /> },
            { key: "Refunded", value: `${formatEth(state.refundedTotal)} ETH` },
          ]}
        />
        <p className="t-small t-muted">
          The pool gets whole tokens at exactly {formatEther(cfg.mintPrice)} ETH each; rounding goes to the treasury. Unsold supply is never minted.
        </p>
      </div>
    </section>
  );
}

function Position({ cfg, user }: { cfg: LauncherConfig; user: UserState }) {
  return (
    <section className={styles.section} aria-labelledby="position-title">
      <h2 className="t-h3" id="position-title">
        Your position
      </h2>
      <div className={styles.panel}>
        <Readout
          rows={[
            { key: "Bought in the sale", value: `${formatInt(user.purchased)} of ${cfg.walletCap} tokens` },
            { key: "Paid", value: `${formatEth(user.paid)} ETH` },
            { key: "Token balance", value: formatEther(user.tokenBalance) },
            { key: "Asterisms held", value: formatInt(user.nftBalance) },
            { key: "ETH in wallet", value: `${formatEth(user.ethBalance)} ETH` },
          ]}
        />
        {user.skipNft ? (
          <Notice tone="warning" title="This wallet opted out of NFTs">
            It holds tokens without asterisms. Turn NFTs back on from your wallet with setSkipNFT(false) on the token contract.
          </Notice>
        ) : null}
        <Link href="/observatory/">Open your observatory</Link>
      </div>
    </section>
  );
}
