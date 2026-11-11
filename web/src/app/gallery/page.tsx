import type { Metadata } from "next";
import { Suspense } from "react";
import { GalleryView } from "@/components/gallery/GalleryView";
import { Main, PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/skeleton/Skeleton";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Every asterism that exists right now, with tier, stars, owner and name, read from the chain.",
};

export default function GalleryPage() {
  return (
    <Main>
      <PageHeader index="Gallery" title="Gallery" lead="Every asterism that exists right now. Filter by tier, find one by id or name, and open any of them." />
      <Suspense
        fallback={
          <div style={{ minHeight: "100svh" }}>
            <Skeleton shape="block" />
          </div>
        }
      >
        <GalleryView />
      </Suspense>
    </Main>
  );
}
