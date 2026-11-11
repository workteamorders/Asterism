import type { Metadata } from "next";
import { LaunchView } from "@/components/launch/LaunchView";
import { Main, PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Launch",
  description: "Status of the Asterism fair launch: price, limits, sale progress, finalization and refunds, read from the chain.",
};

export default function LaunchPage() {
  return (
    <Main>
      <PageHeader
        index="Launch"
        title="Launch"
        lead="Fixed price, whole tokens only, and every cost shown before you sign. Status and figures are read from the chain."
      />
      <LaunchView />
    </Main>
  );
}
