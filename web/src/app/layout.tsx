import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Fieldscape } from "@/components/fieldscape/Fieldscape";
import { Providers } from "@/components/providers/Providers";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SITE_URL } from "@/lib/env";
import "../styles/tokens.css";
import "../styles/base.css";

const archivo = localFont({
  src: "../fonts/archivo-latin-wdth-normal.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const martian = localFont({
  src: "../fonts/martian-mono-latin-wght-normal.woff2",
  variable: "--font-martian",
  weight: "100 800",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Asterism · on-chain asterisms on Robinhood Chain", template: "%s · Asterism" },
  description:
    "2,222 hybrid tokens. One whole token carries one asterism drawn entirely on-chain. Fixed-price fair launch, no tax, liquidity locked by code.",
  applicationName: "Asterism",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192" }], apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Asterism",
    title: "Asterism",
    description: "Asterisms drawn entirely on-chain, one per whole token, on Robinhood Chain.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "An asterism drawn on a graphite field with an instrument readout." }],
  },
  twitter: { card: "summary_large_image", title: "Asterism", description: "Asterisms drawn entirely on-chain on Robinhood Chain.", images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#121315",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${martian.variable}`}>
      <body>
        <Fieldscape />
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <Providers>
          <SiteHeader />
          <OfflineBanner />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
