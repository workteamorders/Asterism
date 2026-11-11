import type { Metadata } from "next";
import { Main, PageHeader } from "@/components/layout/PageHeader";
import { VerifyReveal } from "@/components/rules/VerifyReveal";
import s from "@/components/rules/Rules.module.css";
import { asterismFor, asterismUri, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { MARK_NAMES, TIER_COUNTS, TIER_NAMES, TIER_STARS } from "@/lib/asterism/spec";

export const metadata: Metadata = {
  title: "Rules",
  description: "How the Asterism hybrid works, the five tiers, commit-reveal with a verification tool, automatic burning and minting, and what does not exist.",
};

const EXAMPLES = [23, 1, 142, 38, 97];
const SECTIONS = [
  ["hybrid", "One token, one asterism"],
  ["tiers", "Tiers"],
  ["reveal", "Commit and reveal"],
  ["verify", "Verify the reveal"],
  ["burn", "Burning and minting"],
  ["names", "Names"],
  ["absent", "What does not exist"],
] as const;

export default function RulesPage() {
  return (
    <Main>
      <PageHeader index="Rules" title="Rules" lead="Everything the contracts do, in plain words. Nothing here can change after deployment." />
      <div className={s.layout}>
        <nav className={s.toc} aria-label="On this page">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className={s.prose}>
          <section className={s.block} id="hybrid" aria-labelledby="hybrid-t">
            <h2 className="t-h3" id="hybrid-t">One token, one asterism</h2>
            <p>
              Asterism is a hybrid (DN404): the same collection is both an ERC-20 token and an ERC-721 NFT. Every <strong>whole</strong> token
              in a wallet comes with exactly one asterism NFT. A wallet holding 2.5 tokens holds 2 asterisms; the half token carries none.
            </p>
            <p>
              The supply is 2,222 tokens at most. Up to 1,333 are sold in the launch. At finalization, the contract mints only as many tokens as
              the liquidity share can buy at the sale price, and unsold supply is never minted. If the sale sells out, 1,333 + 888 = 2,221 tokens
              exist, so one tier ends one asterism short of its maximum.
            </p>
          </section>

          <section className={s.block} id="tiers" aria-labelledby="tiers-t">
            <h2 className="t-h3" id="tiers-t">Tiers</h2>
            <p>
              Tier is fixed by a keyed permutation of the ids, so each tier has exactly its maximum count when every id exists, and at most that
              count otherwise. It shows as the number of stars and the shape of the primary star. Colour is never needed to tell tiers apart.
            </p>
            <table className={s.table}>
              <caption className="sr-only">The five tiers with their primary mark, star range and maximum count</caption>
              <thead>
                <tr>
                  <th scope="col">Tier</th>
                  <th scope="col">Primary mark</th>
                  <th scope="col">Stars</th>
                  <th scope="col" className={s.num}>Maximum</th>
                </tr>
              </thead>
              <tbody>
                {TIER_NAMES.map((n, t) => (
                  <tr key={n}>
                    <th scope="row">
                      <span className={s.markCell}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- example render */}
                        <img src={asterismUri(EXAMPLE_SEED, EXAMPLES[t]!)} alt={`Example ${n}, ${asterismFor(EXAMPLE_SEED, EXAMPLES[t]!).stars.length} stars`} width={48} height={48} />
                        {n}
                      </span>
                    </th>
                    <td data-label="Mark:">{MARK_NAMES[t]}</td>
                    <td data-label="Stars:">{TIER_STARS[t]![0]} to {TIER_STARS[t]![1]}</td>
                    <td className={s.num} data-label="Max:">{TIER_COUNTS[t]!.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-small">The small images are examples drawn with an example seed.</p>
          </section>

          <section className={s.block} id="reveal" aria-labelledby="reveal-t">
            <h2 className="t-h3" id="reveal-t">Commit and reveal</h2>
            <ol>
              <li>Before the sale, the revealer picks a secret offline and the launcher is deployed with its hash, <span className="t-mono">commit = keccak256(secret)</span>. It cannot change.</li>
              <li>Every purchase updates a public entropy value: <span className="t-mono">entropy = keccak256(entropy, buyer, amount, index)</span>.</li>
              <li>After finalization the revealer publishes the secret. The contract checks it against the commit and sets the seed.</li>
              <li>If the revealer has not revealed by the deadline, anyone can set a fallback seed from public data.</li>
            </ol>
            <p className={s.formula}>seed = keccak256(secret, entropy) · fallback = keccak256(entropy, commit)</p>
            <p>
              No chain randomness is used. On Robinhood Chain, <span className="t-mono">prevrandao</span> is a constant and{" "}
              <span className="t-mono">block.number</span> follows Ethereum, so neither is a source of randomness.
            </p>
            <p>
              <strong>The one choice the revealer keeps:</strong> after seeing the final entropy, the revealer can compute both outcomes and choose
              to reveal or to stay silent and let the fallback apply. That is one bit of influence, bounded by a commitment made public before the
              first purchase. This is not perfect randomness, and this site does not claim it is.
            </p>
          </section>

          <section className={s.block} id="verify" aria-labelledby="verify-t">
            <h2 className="t-h3" id="verify-t">Verify the reveal</h2>
            <p>Paste the secret once it is published. Your browser checks it against the commitment on-chain and, after the reveal, against the seed.</p>
            <VerifyReveal />
          </section>

          <section className={s.block} id="burn" aria-labelledby="burn-t">
            <h2 className="t-h3" id="burn-t">Burning and minting</h2>
            <ul>
              <li>Asterisms follow whole tokens automatically. If your balance falls below a whole number, the most recently received asterism is burned.</li>
              <li>When another wallet reaches a new whole token, a new asterism is minted to it, often with a different id than the one burned.</li>
              <li>Sending an asterism from the Observatory moves that exact asterism and exactly one token.</li>
              <li>Pools, the launcher and the liquidity sink are marked to hold tokens without asterisms, so trading does not mint art into contracts.</li>
              <li>Do not trade the token and its NFTs from the same wallet at the same moment: an ERC-20 sale can move an asterism you just received.</li>
              <li>Smart-contract wallets that buy in the launch receive their asterisms. Contracts that receive tokens later get none unless they opt in.</li>
            </ul>
          </section>

          <section className={s.block} id="names" aria-labelledby="names-t">
            <h2 className="t-h3" id="names-t">Names</h2>
            <p>
              The holder of an asterism can give it a name of up to 48 letters, numbers, spaces and . , ! ? &apos; - characters. It is printed under
              the stars only while the person who named it still holds it, so a new holder never inherits someone else&apos;s words. Names are public
              and remain in the chain&apos;s history forever.
            </p>
          </section>

          <section className={s.block} id="absent" aria-labelledby="absent-t">
            <h2 className="t-h3" id="absent-t">What does not exist</h2>
            <ul>
              <li>No transfer tax and no trading fee for the project.</li>
              <li>No revenue share, no rewards, and nothing paid to holders.</li>
              <li>No whitelist, no presale, and no team allocation.</li>
              <li>No owner, no admin key, no pause, no upgrade, and no blacklist.</li>
              <li>No way to withdraw pool liquidity, ever.</li>
            </ul>
          </section>
        </div>
      </div>
    </Main>
  );
}
