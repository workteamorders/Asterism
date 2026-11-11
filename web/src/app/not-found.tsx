import type { Metadata } from "next";
import { Main, PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/button/ButtonLink";
import { FocusPuzzle } from "@/components/home/FocusPuzzle";

export const metadata: Metadata = { title: "Out of field", robots: { index: false } };

export default function NotFound() {
  return (
    <Main>
      <PageHeader index="404 · out of field" title="Nothing in this field of view" lead="This page does not exist. While you are here, bring the asterism into focus." />
      <FocusPuzzle />
      <ButtonLink href="/" variant="primary" iconAfter="arrow-right">
        Back to the home page
      </ButtonLink>
    </Main>
  );
}
