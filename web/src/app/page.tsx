import type { CSSProperties } from "react";
import Link from "next/link";
import { StarMap } from "@/components/home/StarMap";
import { Main } from "@/components/layout/PageHeader";
import { AsterismImage } from "@/components/asterism/AsterismImage";
import { Badge } from "@/components/badge/Badge";
import { ButtonLink } from "@/components/button/ButtonLink";
import { Icon } from "@/components/icon/Icon";
import { CountUp } from "@/components/motion/CountUp";
import { Marquee } from "@/components/motion/Marquee";
import { PhaseStage, type Phase } from "@/components/motion/PhaseStage";
import { asterismFor, asterismUri, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { MARK_NAMES, TIER_COUNTS, TIER_NAMES, TIER_STARS } from "@/lib/asterism/spec";
import { AUDIT_REPORT_URL } from "@/lib/env";
import s from "./home.module.css";

// One example per tier from the example seed, chosen at build time.
const TIER_EXAMPLES = [23, 1, 142, 38, 97];
const LIQUIDITY_PERCENT = 6667 / 100;

const FACTS = [
  "2,222 hybrid tokens",
  "One whole token, one asterism",
  "Fixed price sale",
  "No transfer tax",
  "No owner, no admin",
  "Liquidity locked by code",
  "Full refund if not finalized",
  "Seed committed before the sale",
  "Art drawn on-chain as SVG",
] as const;

const PHASES: readonly Phase[] = [
  {
    label: "PHASE 1 · SALE",
    title: "Buy whole tokens",
    body: "Up to 1,333 tokens are sold at one fixed price, at most 5 per transaction and 10 per wallet. Each whole token mints one unrevealed asterism to you. Transfers stay locked until the launch is finalized.",
    caption: "Sealed: each token holds an asterism nobody has seen yet.",
  },
  {
    label: "PHASE 2 · FINALIZE",
    title: "Liquidity, then trading",
    body: "Anyone can finalize once the sale sells out or ends. A Uniswap V2 pool opens at exactly the sale price and its liquidity is locked forever. If nobody finalizes in time, every buyer can get a full refund.",
    caption: "The pool opens at the sale price and its liquidity is locked.",
  },
  {
    label: "PHASE 3 · REVEAL",
    title: "The seed is revealed",
    body: "The secret committed before the sale is published and combined with the purchase history. That fixes every tier and every star. If the revealer stays silent, anyone can trigger a fallback seed after the deadline.",
    caption: "The seed is published and every star and line is fixed.",
  },
];
const PHASE_EXAMPLE = asterismFor(EXAMPLE_SEED, 97);
const order = (n: number, name = "--rise-order") => ({ [name]: n }) as CSSProperties;

const CHECKS = [
  "No owner and no admin. No function can change a parameter, pause trading, or move funds outside the rules.",
  "No transfer tax, no fee, no reward, no revenue share, no whitelist, and no team allocation.",
  "Liquidity tokens are sent to a contract with no functions at all, so they can never be withdrawn.",
  "The art seed was committed before the first purchase and is revealed after the sale. You can check it on the Rules page.",
  "Every figure on this site is read from the chain, and the deployed code can be compared with the published build.",
];

export default function Home() {
  return (
    <Main className={s.home}>
      <StarMap />

      <Marquee items={FACTS} label="Launch facts" />

      <section className={s.section} data-reveal aria-labelledby="tiers-title">
        <div className={s.sectionHead}>
          <h2 className="t-h2" id="tiers-title">
            Five tiers, read from the stars
          </h2>
          <p>
            Tier shows in two ways that survive any screen, even grayscale: how many stars there are, and the shape of the primary
            star. Counts are exact, fixed by the contract, and at most the numbers below if the sale does not sell out.
          </p>
        </div>
        <div className={s.tiers}>
          {TIER_EXAMPLES.map((id, t) => {
            const a = asterismFor(EXAMPLE_SEED, id);
            const [lo, hi] = TIER_STARS[t]!;
            return (
              <div key={id} className={s.tier} data-rise="" style={order(t)}>
                <AsterismImage geometry={a} src={asterismUri(EXAMPLE_SEED, id)} alt={`Example ${TIER_NAMES[a.tier]} asterism with ${a.stars.length} stars.`} size={240} />
                <span className={s.tierName}>
                  {TIER_NAMES[t]}
                  <span className="t-mono t-muted">
                    <CountUp value={TIER_COUNTS[t]!} />
                  </span>
                </span>
                <span className={s.tierMeta}>
                  {lo} to {hi} stars · {MARK_NAMES[t]}
                </span>
              </div>
            );
          })}
        </div>
        <p className={s.note}>
          <Badge tone="example">Example</Badge>
          <span>Drawn with an example seed. Real tiers are only known after the reveal.</span>
        </p>
      </section>

      <section className={s.section} data-reveal aria-labelledby="how-title">
        <div className={s.sectionHead}>
          <h2 className="t-h2" id="how-title">
            How the launch works
          </h2>
          <p>Three phases, all enforced by the contracts. Nobody can skip, extend, or undo a phase.</p>
        </div>
        <PhaseStage phases={PHASES} geometry={PHASE_EXAMPLE} />
      </section>

      <section className={s.section} data-reveal aria-labelledby="money-title">
        <div className={s.sectionHead}>
          <h2 className="t-h2" id="money-title">
            Where the money goes
          </h2>
          <p>
            The sale is the only source of funds. The split is fixed in the contract and computed when the launch is finalized.
          </p>
        </div>
        <div className={s.split}>
          <div className={s.splitBar} role="img" aria-label="About two thirds of sale proceeds go to locked liquidity, about one third to the treasury.">
            <span className={s.splitLiquidity} style={{ width: `${LIQUIDITY_PERCENT}%` }}>
              ≈ 66.67%<span className={s.splitWord}>&nbsp;LIQUIDITY, LOCKED</span>
            </span>
            <span className={s.splitTreasury}>
              ≈ 33.33%<span className={s.splitWord}>&nbsp;TREASURY</span>
            </span>
          </div>
          <div className={s.splitCols}>
            <div className={s.panel} data-inspection>
              <h3>Liquidity, locked by code</h3>
              <p>
                The liquidity share buys the unsold supply at the sale price, so the pool opens at exactly what buyers paid. Rounding to
                whole tokens goes to the treasury. The pool tokens are sent to a contract that has no functions.
              </p>
            </div>
            <div className={s.panel} data-inspection>
              <h3>Treasury, to a fixed address</h3>
              <p>
                The rest can only be sent to the treasury address set at deployment, and anyone can trigger that payment. There are no
                fees on later trades going to the project, and holders receive nothing from the treasury.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={s.section} data-reveal aria-labelledby="verify-title">
        <div className={s.sectionHead}>
          <h2 className="t-h2" id="verify-title">
            Check it yourself
          </h2>
          <p>
            {AUDIT_REPORT_URL ? (
              <>
                An external audit report is published <a href={AUDIT_REPORT_URL}>here</a>. Read it alongside the code.
              </>
            ) : (
              "No external audit yet. Everything below can be checked on-chain without trusting this site."
            )}
          </p>
        </div>
        <ul className={s.checks}>
          {CHECKS.map((c) => (
            <li key={c} className={s.check}>
              <Icon name="check" size={20} />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <div className={s.actions}>
          <Link href="/contracts/">See the contracts and their constants</Link>
        </div>
      </section>

      <section className={s.close} data-reveal aria-labelledby="start-title">
        <h2 className="t-h3" id="start-title">
          Ready to read the launch?
        </h2>
        <p className="t-body t-muted measure">Every cost, limit and consequence is shown before your wallet asks you to sign.</p>
        <PrimaryLink />
      </section>
    </Main>
  );
}

function PrimaryLink() {
  return (
    <ButtonLink href="/launch/" iconAfter="arrow-right">
      Go to the launch
    </ButtonLink>
  );
}
