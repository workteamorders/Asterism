import type { Metadata } from "next";
import { Main, PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/button/ButtonLink";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <Main>
      <PageHeader index="Signal lost" title="You are offline" lead="Nothing can be read from the chain or signed without a connection. Your wallet and your asterisms are unaffected." />
      <ButtonLink href="/" variant="secondary">
        Try the home page again
      </ButtonLink>
    </Main>
  );
}
