import type { Metadata } from "next";
import { Main, PageHeader } from "@/components/layout/PageHeader";
import { Notice } from "@/components/notice/Notice";
import { AUDIT_REPORT_URL } from "@/lib/env";
import s from "../legal.module.css";

export const metadata: Metadata = { title: "Risk notice", description: "The risks of buying, holding and trading Asterism, in plain language." };

export default function RiskPage() {
  return (
    <Main>
      <PageHeader index="Risk · draft" title="Risk notice" lead="Read this before you buy. It is written to be understood, not to protect anyone." />
      <div className={s.prose}>
        <Notice tone="warning" title="Draft, pending legal review">
          This text has not been reviewed by a lawyer yet. It is not legal or financial advice.
        </Notice>
        <section>
          <h2 className="t-h4">What you are buying</h2>
          <p>
            An Asterism token is a digital collectible: a token on Robinhood Chain that, while you hold a whole one, comes with an asterism drawn by
            the contract. It does not give you a share of anything, a claim on any money, or any right against anyone.
          </p>
        </section>
        <section>
          <h2 className="t-h4">You can lose everything you spend</h2>
          <ul>
            <li>There is no promise of any price, now or later. The market price can fall to zero, and there may be nobody to sell to.</li>
            <li>Rarity in this collection describes the art. It says nothing about value.</li>
            <li>Network fees are paid in ETH and are not refunded, even when a transaction fails.</li>
          </ul>
        </section>
        <section>
          <h2 className="t-h4">Technical risks</h2>
          <ul>
            <li>{AUDIT_REPORT_URL ? "The contracts have an external audit, but audits do not find every bug." : "The contracts have no external audit yet. They are tested, but tests do not prove the absence of bugs."}</li>
            <li>No one can pause, change, or repair the contracts. A bug, if one exists, stays forever.</li>
            <li>The hybrid design burns and mints NFTs automatically. Moving part of a token can burn an asterism; the Rules page explains how.</li>
            <li>Robinhood Chain is a separate network run by its own operators. Outages, sequencer delays or changes to the chain are outside this project.</li>
            <li>The reveal depends on one person publishing a secret. If they do not, a fallback seed applies after the deadline. The revealer has one choice: reveal or stay silent.</li>
            <li>Wallet limits are per address. Someone with many addresses can buy more than one wallet&apos;s limit.</li>
          </ul>
        </section>
        <section>
          <h2 className="t-h4">Your responsibilities</h2>
          <ul>
            <li>Keep your wallet and recovery phrase safe. This site never asks for them; anyone who does is trying to steal from you.</li>
            <li>Check every transaction in your wallet before signing. Transactions cannot be reversed.</li>
            <li>Make sure buying digital collectibles is allowed where you live, and handle any tax that applies to you.</li>
          </ul>
        </section>
        <section>
          <h2 className="t-h4">Regional limits</h2>
          <p>
            In some regions this website switches to view only. That is a limit of this interface. The contracts are permissionless and do not check
            where anyone is.
          </p>
        </section>
      </div>
    </Main>
  );
}
