"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEther, getAddress, isAddress, type Address } from "viem";
import { asterismUri, UNREVEALED_URI } from "@/lib/asterism/preview";
import { NAME_ALLOWED, NAME_MAX_BYTES, TIER_NAMES } from "@/lib/asterism/spec";
import { asterismFor } from "@/lib/asterism/preview";
import { mirrorAbi, tokenAbi } from "@/lib/chain/abis";
import { deployment, isDeployed } from "@/lib/chain/deployment";
import { readRendererSvg } from "@/lib/chain/reads";
import { simulateWrite } from "@/lib/chain/tx";
import { useLauncherState, useOwnedIds, useUserState } from "@/lib/hooks/chain";
import { svgUri } from "@/lib/asterism/preview";
import { Button } from "../button/Button";
import { ButtonLink } from "../button/ButtonLink";
import { Field } from "../field/Field";
import { Notice } from "../notice/Notice";
import { useGates } from "../providers/Providers";
import { Readout } from "../readout/Readout";
import { Skeleton } from "../skeleton/Skeleton";
import { EmptyState } from "../state/States";
import { Tabs } from "../tabs/Tabs";
import { useTxFlow } from "../tx/TxFlow";
import { useWallet } from "../wallet/useWallet";
import { FractionCheck } from "./FractionCheck";
import styles from "./Observatory.module.css";

export function ObservatoryView() {
  const wallet = useWallet();
  if (!isDeployed) {
    return (
      <EmptyState title="Nothing to observe yet" action={<ButtonLink href="/gallery/" variant="secondary">See example asterisms</ButtonLink>}>
        The contracts are not deployed, so no wallet holds an asterism.
      </EmptyState>
    );
  }
  if (!wallet.address) {
    return (
      <EmptyState title="Connect a wallet to see your asterisms" action={<Button variant="primary" icon="wallet" onClick={wallet.connect}>Connect wallet</Button>}>
        Your asterisms, their names, and safe sending live here. Browsing the gallery needs no wallet.
      </EmptyState>
    );
  }
  return <Owned address={wallet.address} />;
}

function Owned({ address }: { address: Address }) {
  const owned = useOwnedIds(address);
  const user = useUserState(address);
  const st = useLauncherState();
  const [picked, setSelected] = useState<number | null>(null);
  const ids = useMemo(() => owned.data ?? [], [owned.data]);
  // The picked asterism, or the first one when nothing is picked or the picked one left this wallet.
  const selected = picked !== null && ids.includes(picked) ? picked : (ids[0] ?? null);

  if (owned.isLoading || !st.data) {
    return (
      <div className={styles.layout} aria-busy="true">
        <div className={styles.list}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} shape="square" />
          ))}
        </div>
        <Skeleton shape="block" />
      </div>
    );
  }
  const revealed = st.data.revealed;
  const seed = st.data.seed;
  const fraction = user.data ? user.data.tokenBalance % 10n ** 18n : 0n;

  return (
    <>
      <div className={styles.summary}>
        {user.data ? (
          <Readout
            rows={[
              { key: "Asterisms in this wallet", value: String(ids.length) },
              { key: "Token balance", value: formatEther(user.data.tokenBalance) },
              { key: "Fraction without an asterism", value: formatEther(fraction) },
            ]}
          />
        ) : null}
      </div>
      {ids.length === 0 ? (
        <EmptyState title="This wallet holds no asterism" action={<ButtonLink href="/launch/">Go to the launch</ButtonLink>}>
          An asterism appears for every whole token you hold.
        </EmptyState>
      ) : (
        <div className={styles.layout}>
          <ul className={styles.list} role="list" aria-label="Your asterisms">
            {ids.map((id) => (
              <li key={id}>
                <button type="button" className={styles.pick} aria-pressed={selected === id} onClick={() => setSelected(id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG */}
                  <img src={revealed ? asterismUri(seed, id) : UNREVEALED_URI} alt="" width={160} height={160} />
                  <span className="t-mono">#{id}</span>
                  <span className="t-small t-muted">{revealed ? TIER_NAMES[asterismFor(seed, id).tier] : "Unrevealed"}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected !== null ? <Panel id={selected} address={address} revealed={revealed} seed={seed} /> : null}
        </div>
      )}
      <FractionCheck balance={user.data?.tokenBalance ?? 0n} />
    </>
  );
}

function Panel({ id, address, revealed, seed }: { id: number; address: Address; revealed: boolean; seed: `0x${string}` }) {
  const { geo } = useGates();
  return (
    <section className={styles.panel} data-inspection aria-labelledby="panel-title">
      <h2 className="t-h4" id="panel-title">
        Asterism #{id}
      </h2>
      {geo.viewOnly ? (
        <Notice tone="info" title="View only in your region">
          Naming and sending are turned off in this interface where you are. The contracts themselves stay permissionless.
        </Notice>
      ) : (
        <Tabs
          label={`Actions for asterism ${id}`}
          items={[
            { id: "name", label: "Name", content: <NameForm id={id} revealed={revealed} seed={seed} /> },
            { id: "send", label: "Send", content: <SendForm id={id} from={address} /> },
          ]}
        />
      )}
      <Link href={`/gallery/?id=${id}`}>Open in the gallery</Link>
    </section>
  );
}

function nameError(v: string): string | undefined {
  if (new TextEncoder().encode(v).length > NAME_MAX_BYTES) return `Use at most ${NAME_MAX_BYTES} characters.`;
  if (!NAME_ALLOWED.test(v)) return "Use letters, numbers, spaces and . , ! ? ' - only.";
  return undefined;
}

function NameForm({ id, revealed, seed }: { id: number; revealed: boolean; seed: `0x${string}` }) {
  const tx = useTxFlow();
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const err = touched ? nameError(name) : undefined;
  const token = deployment.addresses!.token;

  const doPreview = async () => {
    setTouched(true);
    if (nameError(name)) return;
    if (!revealed) {
      setPreview(null);
      return;
    }
    setPreviewing(true);
    try {
      setPreview(svgUri(await readRendererSvg(id, seed, name)));
    } catch {
      setPreview(asterismUri(seed, id, name));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (nameError(name)) return;
        tx.run({
          title: name ? "Name your asterism" : "Clear the name",
          confirmLabel: name ? "Save name" : "Clear name",
          successTitle: name ? "Name saved" : "Name cleared",
          summary: [
            { key: "Asterism", value: `#${id}` },
            { key: "New name", value: name || "None" },
          ],
          notes: [
            "Names are public and permanent in the chain's history, even after you change or clear them.",
            "The name shows on the art only while you hold this asterism. A new holder does not inherit it.",
          ],
          simulate: (account) => simulateWrite({ address: token, abi: tokenAbi, functionName: "setName", args: [BigInt(id), name] }, account),
        });
      }}
    >
      <Field
        label="Name"
        value={name}
        maxLength={NAME_MAX_BYTES}
        count={name.length}
        onChange={(e) => {
          setName(e.target.value);
          setPreview(null);
        }}
        onBlur={() => setTouched(true)}
        error={err}
        help="Letters, numbers, spaces and . , ! ? ' - only. Leave empty to clear the name."
        placeholder="Lantern over the quiet field"
      />
      {revealed ? (
        <Button variant="secondary" icon="eye" onClick={doPreview} loading={previewing} loadingLabel="Rendering on-chain">
          Preview on the art
        </Button>
      ) : (
        <p className="t-small t-muted">Names appear on the art after the reveal. You can set one now.</p>
      )}
      {preview ? (
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element -- renderer output */}
          <img src={preview} alt={`Preview of asterism ${id} with the name ${name || "removed"}.`} width={400} height={400} />
        </div>
      ) : null}
      <Button variant="primary" type="submit">
        Review name
      </Button>
      {tx.dialog}
    </form>
  );
}

function SendForm({ id, from }: { id: number; from: Address }) {
  const tx = useTxFlow();
  const [to, setTo] = useState("");
  const [touched, setTouched] = useState(false);
  const mirror = deployment.addresses!.mirror;
  const trimmed = to.trim();
  const err = touched
    ? !isAddress(trimmed, { strict: false })
      ? "Enter a full 0x address (42 characters)."
      : getAddress(trimmed) === getAddress(from)
        ? "That is this wallet."
        : undefined
    : undefined;
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!isAddress(trimmed, { strict: false }) || getAddress(trimmed) === getAddress(from)) return;
        const recipient = getAddress(trimmed);
        tx.run({
          title: "Send this asterism",
          confirmLabel: `Send asterism #${id}`,
          successTitle: `Asterism #${id} sent`,
          danger: true,
          summary: [
            { key: "Asterism", value: `#${id}` },
            { key: "Moves exactly", value: "1 whole token" },
            { key: "Recipient", value: recipient },
          ],
          notes: [
            "Sending is permanent. Check the recipient: nobody can reverse it.",
            "Your name on this asterism stops showing once it leaves your wallet.",
            "This uses safeTransferFrom: a contract that cannot hold NFTs is refused before anything moves.",
          ],
          simulate: (account) =>
            simulateWrite({ address: mirror, abi: mirrorAbi, functionName: "safeTransferFrom", args: [from, recipient, BigInt(id)] }, account),
        });
      }}
    >
      <Field
        label="Recipient address"
        value={to}
        mono
        spellCheck={false}
        autoComplete="off"
        placeholder="0x…"
        onChange={(e) => setTo(e.target.value)}
        onBlur={() => setTouched(true)}
        error={err}
        help="Sends this asterism and exactly one whole token. Your other tokens and fractions stay put."
      />
      <Button variant="primary" type="submit">
        Review send
      </Button>
      {tx.dialog}
    </form>
  );
}
