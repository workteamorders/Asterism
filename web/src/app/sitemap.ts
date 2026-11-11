import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "launch/", "gallery/", "observatory/", "rules/", "contracts/", "risk/", "terms/"];
  return pages.map((p) => ({ url: `${SITE_URL}/${p}`, changeFrequency: "daily", priority: p === "" ? 1 : 0.6 }));
}
