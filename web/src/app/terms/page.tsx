import type { Metadata } from "next";
import { Main, PageHeader } from "@/components/layout/PageHeader";
import { Notice } from "@/components/notice/Notice";
import s from "../legal.module.css";

export const metadata: Metadata = { title: "Terms of use", description: "Terms for using the Asterism website, and how it handles data." };

export default function TermsPage() {
  return (
    <Main>
      <PageHeader index="Terms · draft" title="Terms of use" lead="The short version: this website is an interface to public contracts, and you use both at your own risk." />
      <div className={s.prose}>
        <Notice tone="warning" title="Draft, pending legal review">
          These terms are a working draft. They will be reviewed before the sale opens and may change until then.
        </Notice>
        <section>
          <h2 className="t-h4">The website</h2>
          <p>
            This website reads public data from Robinhood Chain and prepares transactions for your wallet to sign. It does not hold funds, keys or
            tokens, and it cannot act on your behalf. The contracts work without it.
          </p>
        </section>
        <section>
          <h2 className="t-h4">No advice, no promises</h2>
          <p>
            Nothing on this website is financial, legal or tax advice. There is no promise about the price, use or future of Asterism, and no
            obligation to build anything further.
          </p>
        </section>
        <section>
          <h2 className="t-h4">Availability</h2>
          <p>
            The website may be unavailable, slow, or show out-of-date data. Always check important figures on a block explorer before acting.
          </p>
        </section>
        <section>
          <h2 className="t-h4">Names you give</h2>
          <p>
            Names you write on an asterism are public, permanent in the chain&apos;s history, and your own responsibility. Do not write personal
            information.
          </p>
        </section>
        <section id="privacy">
          <h2 className="t-h4">Privacy</h2>
          <ul>
            <li>No account, no sign-up, no analytics, and no advertising cookies.</li>
            <li>Your browser keeps one preference locally: that you accepted the risk notice. Clearing site data removes it.</li>
            <li>Read requests to the chain pass through this site&apos;s server to its RPC provider. They include the addresses you look at, as any blockchain read does. The server keeps no logs of its own beyond what the hosting provider records.</li>
            <li>Your country is read from the hosting network only to decide whether this interface runs in view-only mode. It is not stored.</li>
          </ul>
        </section>
      </div>
    </Main>
  );
}
