import type { Metadata } from "next";
import { AsterismImage } from "@/components/asterism/AsterismImage";
import { Badge } from "@/components/badge/Badge";
import { Button } from "@/components/button/Button";
import { Field } from "@/components/field/Field";
import { Icon, ICON_NAMES } from "@/components/icon/Icon";
import { Notice } from "@/components/notice/Notice";
import { GUIDE_NAMES, MARK_NAMES, TIER_COUNTS, TIER_NAMES } from "@/lib/asterism/spec";
import {
  byGuide,
  byTier,
  named,
  ratio,
  stats,
  swatchGroups,
  tierRows,
  unnamedSame,
  unrevealedSrc,
  type Rendered,
} from "./data";
import { Components } from "./Components";
import s from "./styleguide.module.css";

export const metadata: Metadata = {
  title: "Styleguide",
  description: "Internal reference for Asterism design tokens, components, and on-chain art.",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  ["colour", "Colour"],
  ["type", "Type"],
  ["space", "Space"],
  ["shape", "Shape and elevation"],
  ["motion", "Motion"],
  ["icons", "Icons"],
  ["motif", "Motif"],
  ["art", "Asterism art"],
  ["primitives", "Primitives"],
  ["components", "Components and states"],
] as const;

function SectionHead({ index, id, title, children }: { index: string; id: string; title: string; children?: React.ReactNode }) {
  return (
    <header className={s.sectionHead}>
      <span className={s.index}>SG-{index}</span>
      <h2 className="t-h2" id={`${id}-title`}>
        {title}
      </h2>
      {children ? <p className={`t-body t-muted measure`}>{children}</p> : null}
    </header>
  );
}

function ArtCaption({ r }: { r: Rendered }) {
  return (
    <>
      <span>
        <strong>{TIER_NAMES[r.a.tier]}</strong> · {r.a.stars.length} stars
      </span>
      <span>
        {MARK_NAMES[r.a.tier]} · {GUIDE_NAMES[r.a.guide]} · <span className="t-mono">#{r.a.id}</span>
      </span>
    </>
  );
}

const TYPE_ROLES = [
  { cls: "t-display", spec: "Display · 60 / 1.05 · 560 · wdth 120", sample: "Asterisms, measured" },
  { cls: "t-h1", spec: "H1 · 44 / 1.15 · 560 · wdth 112", sample: "Every star is on-chain" },
  { cls: "t-h2", spec: "H2 · 32 / 1.15 · 600 · wdth 112", sample: "How the reveal works" },
  { cls: "t-h3", spec: "H3 · 24 / 1.3 · 600", sample: "Where the money goes" },
  { cls: "t-h4", spec: "H4 · 20 / 1.3 · 600", sample: "Before you sign" },
  {
    cls: "t-body",
    spec: "Body · 16 / 1.6 · 400",
    sample:
      "Each whole token carries one asterism. If your balance drops below a whole token, the asterism it carried is burned, and a different one is minted to whoever receives the whole token.",
  },
  { cls: "t-small", spec: "Small · 14 / 1.5 · 400", sample: "Gas is paid in ETH on Robinhood Chain." },
  { cls: "t-label", spec: "Label · 12 / 1.3 · 600 · wdth 82 · caps", sample: "Sale progress" },
  { cls: "t-mono", spec: "Mono · Martian Mono 14 · tabular", sample: "0x8bce…937f  1,333 / 2,222  0.0203 gwei" },
] as const;

const SPACES = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

const MOTION = [
  { token: "--dur-micro", value: "100ms ease-out", use: "Press, hover, toggle", cls: s.puckMicro },
  { token: "--dur-element", value: "200ms ease-out", use: "Element enters or changes", cls: s.puckElement },
  { token: "--dur-panel", value: "320ms ease-out", use: "Panels, sheets, dialogs", cls: s.puckPanel },
  { token: "--ease-step", value: "steps(3) over 320ms", use: "Focus pull: loading to sharp", cls: s.puckStep },
] as const;

export default function StyleguidePage() {
  return (
    <main id="main" className={s.page}>
      <header className={s.intro}>
        <p className="t-label t-muted">Internal · not linked from the site</p>
        <h1 className="t-h1">Styleguide</h1>
        <p className="t-body t-muted measure">
          Every token and primitive in one place, with the on-chain art rendered by the reference renderer. The art
          below uses an example seed; real tiers only exist after the reveal.
        </p>
        <div className={s.chips}>
          <Badge icon="reticle">Direction: Diffraction</Badge>
          <Badge tone="example">Example data</Badge>
          <Badge tone="warning">No contract deployed</Badge>
        </div>
      </header>

      <nav className={s.toc} aria-label="Styleguide sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <section id="colour" className={s.section} aria-labelledby="colour-title">
        <SectionHead index="01" id="colour" title="Colour">
          A neutral graphite housing, warm starlight, and one focus-confirm accent used on about one action per view.
          Ratios are measured against --surface.
        </SectionHead>
        {swatchGroups.map((g) => (
          <div key={g.title} className={s.sub}>
            <h3 className={s.subTitle}>{g.title}</h3>
            <ul className={s.swatches} role="list">
              {g.items.map((it) => (
                <li key={it.token} className={s.swatch}>
                  {/* Swatch colour is data, so an inline value is the honest way to show it. */}
                  <span className={s.chip} style={{ background: it.hex }} aria-hidden="true" />
                  <span className={s.swatchMeta}>
                    <span className={s.token}>{it.token}</span>
                    <span className={s.swatchRole}>{it.role}</span>
                    <span className={s.ratio}>
                      {it.hex.toUpperCase()}
                      {it.against ? ` · ${ratio(it.hex, it.against)}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section id="type" className={s.section} aria-labelledby="type-title">
        <SectionHead index="02" id="type" title="Type">
          Archivo for text, using its width axis: wide for headings, condensed for labels. Martian Mono for figures,
          addresses, and readouts.
        </SectionHead>
        <div className={s.typeList}>
          {TYPE_ROLES.map((t) => (
            <div key={t.cls} className={s.typeRow}>
              <span className={s.typeSpec}>{t.spec}</span>
              <p className={`${t.cls} ${s.typeSample} ${t.cls === "t-body" ? "measure" : ""}`}>{t.sample}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="space" className={s.section} aria-labelledby="space-title">
        <SectionHead index="03" id="space" title="Space">
          Multiples of four only. Three rhythm steps: tight 8, medium 24, loose 64.
        </SectionHead>
        <div className={s.spaceList}>
          {SPACES.map((v) => (
            <div key={v} className={s.spaceRow}>
              <span className="t-mono t-muted">--space-{v}</span>
              <span className={`${s.bar} ${s[`w${v}`]}`} aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      <section id="shape" className={s.section} aria-labelledby="shape-title">
        <SectionHead index="04" id="shape" title="Shape and elevation">
          Sharp 2px corners and 1px lines everywhere. Layers separate by luminance steps, never by blurred shadows.
        </SectionHead>
        <div className={s.shapeRow}>
          <span className={s.cornerDemo} aria-hidden="true" />
          <p className="t-small t-muted">--radius 2px · --border 1px · focus ring 2px accent, 2px offset</p>
        </div>
        <div className={s.elevations}>
          <div className={`${s.elev} ${s.flat}`}>
            <span className="t-label">Flat</span>
            <span className="t-small t-muted">--surface with a decorative line</span>
          </div>
          <div className={`${s.elev} ${s.raised}`}>
            <span className="t-label">Raised</span>
            <span className="t-small t-muted">--surface-raised, one step lighter</span>
          </div>
          <div className={`${s.elev} ${s.floating}`}>
            <span className="t-label">Floating</span>
            <span className="t-small t-muted">--surface-floating plus a 1px ring</span>
          </div>
        </div>
      </section>

      <section id="motion" className={s.section} aria-labelledby="motion-title">
        <SectionHead index="05" id="motion" title="Motion">
          Stepped and firm, like a focus motor. Only transform and opacity move. With reduced motion, every duration
          drops to zero and nothing breaks.
        </SectionHead>
        <div className={s.motionDemo} tabIndex={0} aria-label="Motion demo. Hover or focus to run.">
          {MOTION.map((m) => (
            <div key={m.token} className={s.motionRow}>
              <span>
                <span className="t-mono">{m.token}</span>
                <br />
                <span className="t-small t-muted">
                  {m.value} · {m.use}
                </span>
              </span>
              <span className={s.track} aria-hidden="true">
                <span className={`${s.puck} ${m.cls}`} />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section id="icons" className={s.section} aria-labelledby="icons-title">
        <SectionHead index="06" id="icons" title="Icons">
          One family on a 24 grid: 1.25px strokes at 20px, flat ends, mitred corners. No emoji anywhere in the interface.
        </SectionHead>
        <ul className={s.icons} role="list">
          {ICON_NAMES.map((n) => (
            <li key={n} className={s.iconCell}>
              <Icon name={n} size={24} />
              {n}
            </li>
          ))}
        </ul>
      </section>

      <section id="motif" className={s.section} aria-labelledby="motif-title">
        <SectionHead index="07" id="motif" title="Motif">
          The reticle tick and the focus-confirm dot. Used in five places only, so they stay meaningful.
        </SectionHead>
        <div className={s.motifGrid}>
          <div className={s.motifCard}>
            <svg className={s.reticleBox} viewBox="0 0 320 96" preserveAspectRatio="none" aria-hidden="true">
              <path d="M160 0V10M160 86V96M0 48H10M310 48H320M148 48H156M164 48H172M160 36V44M160 52V60" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="t-label">Reticle tick</span>
            <p>Edge ticks on every asterism frame and on section indexes. It says: this is a measured field.</p>
          </div>
          <div className={s.motifCard}>
            <span className={s.confirmDot}>SIMULATION PASSED</span>
            <span className="t-label">Focus-confirm dot</span>
            <p>
              Lights only when a transaction simulation succeeds, right before the wallet asks you to sign. Never
              decorative.
            </p>
          </div>
          <div className={s.motifCard}>
            <Icon name="spike" size={24} />
            <span className="t-label">Places it appears</span>
            <p>Art frames, section indexes, the pre-signature summary, loading focus pulls, and the 404 page.</p>
          </div>
        </div>
      </section>

      <section id="art" className={s.section} aria-labelledby="art-title">
        <SectionHead index="08" id="art" title="Asterism art">
          Rendered by the TypeScript reference renderer that the Solidity renderer must match byte for byte. Example
          seed, not the launch seed.
        </SectionHead>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Five tiers, at their maximum star count</h3>
          <div className={s.artGrid}>
            {byTier.map((r) => (
              <AsterismImage key={r.a.id} src={r.src} alt={r.alt} caption={<ArtCaption r={r} />} />
            ))}
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Three guide styles, picked from the seed</h3>
          <div className={s.artGrid3}>
            {byGuide.map((r) => (
              <AsterismImage key={r.a.id} src={r.src} alt={r.alt} caption={<ArtCaption r={r} />} />
            ))}
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>States</h3>
          <div className={s.artGrid3}>
            <AsterismImage
              src={unrevealedSrc}
              alt="Unrevealed asterism: an empty measured field, identical for every id until the reveal."
              caption={
                <>
                  <strong>Before the reveal</strong>
                  <span>Same image for every id</span>
                </>
              }
            />
            <AsterismImage
              src={named.src}
              alt={named.alt}
              caption={
                <>
                  <strong>Named</strong>
                  <span>Shown while the namer still holds it</span>
                </>
              }
            />
            <AsterismImage
              src={unnamedSame.src}
              alt={unnamedSame.alt}
              caption={
                <>
                  <strong>After a transfer</strong>
                  <span>The old name is not shown to the new holder</span>
                </>
              }
            />
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Grayscale and thumbnail check</h3>
          <p className={s.note}>
            Tiers must read from star count and the primary mark alone. Below: grayscale at 120px, then 64px thumbnails
            as a marketplace grid would show them.
          </p>
          <div className={s.thumbs}>
            {byTier.map((r) => (
              <div key={`g${r.a.id}`} className={s.thumb120}>
                <AsterismImage src={r.src} alt={`${r.alt} Grayscale.`} grayscale size={120} caption={TIER_NAMES[r.a.tier]} />
              </div>
            ))}
          </div>
          <div className={s.thumbs}>
            {byTier.map((r) => (
              <div key={`t${r.a.id}`} className={s.thumb64}>
                <AsterismImage src={r.src} alt={`${r.alt} Thumbnail.`} size={64} />
              </div>
            ))}
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Reference renderer report · example seed</h3>
          <div className={s.readouts}>
            <div className={s.readout}>
              <span className="t-label t-muted">Ids rendered</span>
              <span className={s.readoutValue}>{stats.total.toLocaleString("en-US")}</span>
            </div>
            <div className={s.readout}>
              <span className="t-label t-muted">Unique images</span>
              <span className={s.readoutValue}>{stats.unique.toLocaleString("en-US")}</span>
            </div>
            <div className={s.readout}>
              <span className="t-label t-muted">Largest SVG</span>
              <span className={s.readoutValue}>{stats.maxBytes.toLocaleString("en-US")} B</span>
            </div>
            <div className={s.readout}>
              <span className="t-label t-muted">Fallback stars</span>
              <span className={s.readoutValue}>{stats.fallback}</span>
            </div>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption className="sr-only">Tier distribution for the example seed compared with the published maximums</caption>
              <thead>
                <tr>
                  <th scope="col">Tier</th>
                  <th scope="col" className={s.hideNarrow}>
                    Primary mark
                  </th>
                  <th scope="col">Stars</th>
                  <th scope="col" className={s.num}>
                    Maximum
                  </th>
                  <th scope="col" className={s.num}>
                    Example
                  </th>
                </tr>
              </thead>
              <tbody>
                {tierRows.map((row, t) => (
                  <tr key={row.name}>
                    <th scope="row">{row.name}</th>
                    <td className={s.hideNarrow}>{row.mark}</td>
                    <td>{row.stars}</td>
                    <td className={s.num}>{TIER_COUNTS[t]!.toLocaleString("en-US")}</td>
                    <td className={s.num}>{stats.counts[t]!.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.note}>
            Counts come from rendering every id 1 to 2,222. If the sale does not sell out, the final supply is smaller
            and each tier holds at most its maximum.
          </p>
        </div>
      </section>

      <section id="primitives" className={s.section} aria-labelledby="primitives-title">
        <SectionHead index="09" id="primitives" title="Primitives">
          Buttons, fields, badges and notices in every state.
        </SectionHead>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Button variants</h3>
          <div className={s.row}>
            <Button variant="primary" iconAfter="arrow-right">
              Review purchase
            </Button>
            <Button variant="secondary" icon="wallet">
              Connect wallet
            </Button>
            <Button variant="ghost" icon="copy">
              Copy address
            </Button>
            <Button variant="danger" icon="alert">
              Refund 2 tokens
            </Button>
            <Button variant="secondary" iconOnly icon="menu" label="Open menu" />
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Button states · primary and secondary</h3>
          <div className={s.stateGrid}>
            {(["primary", "secondary"] as const).flatMap((v) => [
              <div key={`${v}-d`} className={s.stateCell}>
                <span className={s.stateName}>{v} · default</span>
                <Button variant={v}>Review purchase</Button>
              </div>,
              <div key={`${v}-h`} className={s.stateCell}>
                <span className={s.stateName}>{v} · hover</span>
                <Button variant={v} forceState="hover">
                  Review purchase
                </Button>
              </div>,
              <div key={`${v}-f`} className={s.stateCell}>
                <span className={s.stateName}>{v} · focus</span>
                <Button variant={v} forceState="focus">
                  Review purchase
                </Button>
              </div>,
              <div key={`${v}-p`} className={s.stateCell}>
                <span className={s.stateName}>{v} · pressed</span>
                <Button variant={v} forceState="pressed">
                  Review purchase
                </Button>
              </div>,
              <div key={`${v}-l`} className={s.stateCell}>
                <span className={s.stateName}>{v} · loading</span>
                <Button variant={v} loading loadingLabel="Simulating">
                  Review purchase
                </Button>
              </div>,
              <div key={`${v}-x`} className={s.stateCell}>
                <span className={s.stateName}>{v} · disabled</span>
                <Button variant={v} disabled>
                  Review purchase
                </Button>
              </div>,
            ])}
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Sizes</h3>
          <div className={s.row}>
            <Button size="s">Small 44</Button>
            <Button size="m">Medium 48</Button>
            <Button size="l">Large 56</Button>
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Fields</h3>
          <div className={s.fieldGrid}>
            <Field label="Tokens to buy" defaultValue="2" inputMode="numeric" mono suffix="of 5 max" help="Whole tokens only. One token carries one asterism." />
            <Field label="Tokens to buy" defaultValue="2" inputMode="numeric" mono suffix="of 5 max" forceState="hover" help="Hover" />
            <Field label="Tokens to buy" defaultValue="2" inputMode="numeric" mono suffix="of 5 max" forceState="focus" help="Focus" />
            <Field label="Tokens to buy" defaultValue="7" inputMode="numeric" mono suffix="of 5 max" error="Enter 1 to 5 tokens. Each transaction can buy at most 5." />
            <Field label="Asterism name" defaultValue="Lantern over the quiet field" maxLength={48} count={28} help="Letters, numbers, spaces and . , ! ? ' - only. Public and permanent." />
            <Field label="Tokens to buy" defaultValue="2" mono suffix="of 5 max" disabled help="Sale has not started." />
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Badges</h3>
          <div className={s.row}>
            <Badge>Dust</Badge>
            <Badge tone="success">Confirmed</Badge>
            <Badge tone="warning">Awaiting finalization</Badge>
            <Badge tone="danger">Failed</Badge>
            <Badge tone="info">Read only</Badge>
            <Badge tone="example">Example</Badge>
          </div>
        </div>

        <div className={s.sub}>
          <h3 className={s.subTitle}>Notices</h3>
          <div className={s.stack}>
            <Notice tone="success" title="Purchase confirmed">
              2 tokens minted to your wallet. Your asterisms stay unrevealed until the launch is finalized.
            </Notice>
            <Notice tone="warning" title="Sending part of a token">
              Sending 0.5 tokens drops you below a whole token, so the asterism you hold now will be burned.
            </Notice>
            <Notice tone="danger" title="Transaction failed">
              The simulation reverted: sale has ended. No ETH left your wallet.
            </Notice>
            <Notice tone="info" title="View only in your region">
              Buying, naming, and sending are turned off in this interface. The contracts themselves stay permissionless.
            </Notice>
          </div>
        </div>
      </section>

      <section id="components" className={s.section} aria-labelledby="components-title">
        <SectionHead index="10" id="components" title="Components and states">
          Interactive pieces, empty and error states, and every phase of a transaction.
        </SectionHead>
        <Components />
      </section>
    </main>
  );
}
