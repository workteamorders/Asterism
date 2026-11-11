"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { decodeTokenUri } from "@/lib/asterism/metadata";
import { asterismFor, asterismUri, EXAMPLE_SEED, svgUri } from "@/lib/asterism/preview";
import { GUIDE_NAMES, MARK_NAMES, MAX_SUPPLY_TOKENS, TIER_NAMES } from "@/lib/asterism/spec";
import { renderAsterismSvg } from "@/lib/asterism/svg";
import { tokenAbi } from "@/lib/chain/abis";
import { publicClient } from "@/lib/chain/client";
import { deployment, isDeployed } from "@/lib/chain/deployment";
import { explain } from "@/lib/chain/errors";
import { readTokenUri } from "@/lib/chain/reads";
import { useLauncherState } from "@/lib/hooks/chain";
import { Address } from "../address/Address";
import { Badge } from "../badge/Badge";
import { Icon } from "../icon/Icon";
import { Readout } from "../readout/Readout";
import { Skeleton } from "../skeleton/Skeleton";
import { EmptyState, ErrorState } from "../state/States";
import styles from "./Gallery.module.css";

const ZERO = "0x0000000000000000000000000000000000000000";

export function DetailView({ id }: { id: number }) {
  return (
    <div className={styles.detail}>
      {isDeployed ? <LiveDetail id={id} /> : <ExampleDetail id={id} />}
      <nav className={styles.pager} aria-label="Neighbouring asterisms">
        <Link className={styles.back} href="/gallery/">
          <Icon name="grid" size={20} />
          All asterisms
        </Link>
        <span className={styles.filters}>
          {id > 1 ? <Link className={styles.back} href={`/gallery/?id=${id - 1}`}>Previous #{id - 1}</Link> : null}
          {id < MAX_SUPPLY_TOKENS ? <Link className={styles.back} href={`/gallery/?id=${id + 1}`}>Next #{id + 1}</Link> : null}
        </span>
      </nav>
    </div>
  );
}

function Traits({ id, seed, name }: { id: number; seed: `0x${string}`; name: string }) {
  const a = asterismFor(seed, id);
  return (
    <Readout
      rows={[
        { key: "Tier", value: TIER_NAMES[a.tier] },
        { key: "Stars", value: String(a.stars.length) },
        { key: "Primary mark", value: MARK_NAMES[a.tier] },
        { key: "Guide", value: GUIDE_NAMES[a.guide] },
        { key: "Name", value: name || "None" },
      ]}
    />
  );
}

function ExampleDetail({ id }: { id: number }) {
  return (
    <>
      <figure className={styles.detailArt}>
        <span className={styles.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG */}
          <img src={asterismUri(EXAMPLE_SEED, id)} alt={`Example asterism ${id}.`} width={400} height={400} />
        </span>
      </figure>
      <section className={styles.detailInfo} aria-labelledby="detail-title">
        <h2 className="t-h3" id="detail-title">
          Asterism #{id}
        </h2>
        <Badge tone="example">Example · not deployed</Badge>
        <Traits id={id} seed={EXAMPLE_SEED} name="" />
        <p className="t-small t-muted">Drawn with an example seed by the reference renderer. Nobody owns it.</p>
      </section>
    </>
  );
}

function LiveDetail({ id }: { id: number }) {
  const st = useLauncherState();
  const token = deployment.addresses!.token;
  const info = useQuery({
    queryKey: ["asterism", id],
    queryFn: async () => {
      const c = publicClient();
      const owner = (await c.readContract({ address: token, abi: tokenAbi, functionName: "ownerAt", args: [BigInt(id)] })) as `0x${string}`;
      if (owner === ZERO) return { owner: null, name: "", uri: null };
      const name = (await c.readContract({ address: token, abi: tokenAbi, functionName: "nameOf", args: [BigInt(id)] })) as string;
      const uri = await readTokenUri(id);
      return { owner, name, uri };
    },
  });
  if (info.isError) {
    const e = explain(info.error, "read");
    return <ErrorState title="This asterism could not be read" what={e.detail} safety="Nothing is affected on-chain." next="Try again in a moment." />;
  }
  if (!info.data || !st.data) {
    return (
      <>
        <Skeleton shape="square" />
        <div className={styles.detailInfo} aria-busy="true">
          <Skeleton width="50%" />
          <Skeleton width="80%" />
          <Skeleton width="70%" />
        </div>
      </>
    );
  }
  if (!info.data.owner || !info.data.uri) {
    return (
      <EmptyState title={`Asterism #${id} does not exist right now`}>
        It was never minted, or it was burned because its holder dropped below a whole token. A new asterism can take this id later.
      </EmptyState>
    );
  }
  const meta = decodeTokenUri(info.data.uri);
  const onchainSvg = meta.image.startsWith("data:image/svg+xml;base64,") ? atob(meta.image.slice(26)) : "";
  const revealed = st.data.revealed;
  const matches = revealed ? onchainSvg === renderAsterismSvg(asterismFor(st.data.seed, id), info.data.name) : null;
  return (
    <>
      <figure className={styles.detailArt}>
        <span className={styles.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element -- on-chain SVG */}
          <img src={svgUri(onchainSvg)} alt={`Asterism ${id} as rendered by the contract${revealed ? "" : ", not yet revealed"}.`} width={400} height={400} />
        </span>
        <figcaption className="t-small t-muted">Image returned by tokenURI on-chain.</figcaption>
      </figure>
      <section className={styles.detailInfo} aria-labelledby="detail-title">
        <h2 className="t-h3" id="detail-title">
          {meta.name}
        </h2>
        {revealed ? <Traits id={id} seed={st.data.seed} name={info.data.name} /> : <Badge tone="info">Not yet revealed</Badge>}
        <Readout rows={[{ key: "Owner", value: <Address value={info.data.owner} label="owner" /> }]} />
        {matches === true ? (
          <p className="t-small t-muted">The on-chain image matches the reference renderer byte for byte.</p>
        ) : matches === false ? (
          <Badge tone="warning">On-chain image differs from the reference renderer</Badge>
        ) : null}
      </section>
    </>
  );
}
