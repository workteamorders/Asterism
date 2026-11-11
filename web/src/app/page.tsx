import Link from "next/link";
import { HeroArt } from "@/components/home/HeroArt";
import { LiveReadout } from "@/components/home/LiveReadout";
import { Main } from "@/components/layout/PageHeader";
import { AsterismImage } from "@/components/asterism/AsterismImage";
import { Badge } from "@/components/badge/Badge";
import { ButtonLink } from "@/components/button/ButtonLink";
import { Icon } from "@/components/icon/Icon";
import { asterismFor, asterismUri, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { MARK_NAMES, TIER_COUNTS, TIER_NAMES, TIER_STARS } from "@/lib/asterism/spec";
import { AUDIT_REPORT_URL } from "@/lib/env";
import s from "./home.module.css";

// One example per tier from the example seed, chosen at build time.
const TIER_EXAMPLES = [23, 1, 142, 38, 97];
const LIQUIDITY_PERCENT = 6667 / 100;

const CHECKS = [
  "No owner and no admin. No function can change a parameter, pause trading, or move funds outside the rules.",
  "No transfer tax, no fee, no reward, no revenue share, no whitelist, and no team allocation.",
  "Liquidity tokens are sent to a contract with no functions at all, so they can never be withdrawn.",
  "The art seed was committed before the first purchase and is revealed after the sale. You can check it on the Rules page.",
  "Every figure on this site is read from the chain, and the deployed code can be compared with the published build.",
];

export default function Home() {
  return (
    <Main>
      <section className={s.hero} aria-labelledby="hero-title">
        <div className={s.heroText}>
          <span className={s.kicker}>On-chain asterisms · Robinhood Chain</span>
          <h1 className="t-display" id="hero-title">
            Every asterism is drawn by the contract.
          </h1>
          <p className={s.lead}>
            2,222 hybrid tokens. One whole token carries one asterism: stars, lines and a tier mark rendered as SVG on-chain from
            a seed revealed after the sale. Fixed price, no tax, and pool liquidity that can never be withdrawn.
          </p>
          <div className={s.actions}>
            <PrimaryLink />
            <Link href="/rules/" className="t-small">
              How it works
            </Link>
          </div>
          <LiveReadout />
        </div>
        <HeroArt />
      </section>

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
              <div key={id} className={s.tier}>
                <AsterismImage geometry={a} src={asterismUri(EXAMPLE_SEED, id)} alt={`Example ${TIER_NAMES[a.tier]} asterism with ${a.stars.length} stars.`} size={240} />
                <span className={s.tierName}>
                  {TIER_NAMES[t]}
                  <span className="t-mono t-muted">{TIER_COUNTS[t]!.toLocaleString("en-US")}</span>
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
        <ol className={s.phases}>
          <li className={s.phase}>
            <span className={s.phaseLabel}>PHASE 1 · SALE</span>
            <h3>Buy whole tokens</h3>
            <p>
              Up to 1,333 tokens are sold at one fixed price, at most 5 per transaction and 10 per wallet. Each whole token mints one
              unrevealed asterism to you. Transfers stay locked until the launch is finalized.
            </p>
          </li>
          <li className={s.phase}>
            <span className={s.phaseLabel}>PHASE 2 · FINALIZE</span>
            <h3>Liquidity, then trading</h3>
            <p>
              Anyone can finalize once the sale sells out or ends. A Uniswap V2 pool opens at exactly the sale price and its
              liquidity is locked forever. If nobody finalizes in time, every buyer can get a full refund.
            </p>
          </li>
          <li className={s.phase}>
            <span className={s.phaseLabel}>PHASE 3 · REVEAL</span>
            <h3>The seed is revealed</h3>
            <p>
              The secret committed before the sale is published and combined with the purchase history. That fixes every tier and
              every star. If the revealer stays silent, anyone can trigger a fallback seed after the deadline.
            </p>
          </li>
        </ol>
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
