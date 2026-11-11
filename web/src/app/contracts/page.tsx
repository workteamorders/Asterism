import type { Metadata } from "next";
import { ContractsView } from "@/components/contracts/ContractsView";
import { Main, PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Contracts",
  description: "Asterism contract addresses, constants read from the chain, code checks against this build, and who holds which role.",
};

export default function ContractsPage() {
  return (
    <Main>
      <PageHeader index="Contracts" title="Contracts" lead="Addresses, constants and roles, read from the chain and compared with this build. Trust the chain over this page." />
      <ContractsView />
    </Main>
  );
}
