import type { Metadata } from "next";
import { Main, PageHeader } from "@/components/layout/PageHeader";
import { ObservatoryView } from "@/components/observatory/ObservatoryView";

export const metadata: Metadata = {
  title: "Observatory",
  description: "Your asterisms: name them, send them safely, and check what a token transfer would do before you make it.",
};

export default function ObservatoryPage() {
  return (
    <Main>
      <PageHeader index="Observatory" title="Your observatory" lead="Your asterisms, their names, and safe sending. Every action is simulated before your wallet asks you to sign." />
      <ObservatoryView />
    </Main>
  );
}
