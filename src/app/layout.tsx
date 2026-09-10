import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { OPERATOR } from "@/lib/operator";
import { BID_FAMILY } from "@/lib/bid-family";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "BidKeep | Federal Facilities Opportunity Tracking";
const DESCRIPTION =
  "BidKeep tracks SAM.gov solicitations for janitorial, grounds, security guards/patrol, and facilities support — recompete radar for option and period-end language, set-aside type on every row, and SCA wage-determination links when the notice includes them.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com"),
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "BidKeep",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  verification: {
    google: "W3WV03toR7gLRzxrDWVB5qe-rcHQCwg5C8ejJxjXQ7I",
  },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BidKeep",
  url: OPERATOR.siteUrl,
  applicationCategory: "BusinessApplication",
  description: DESCRIPTION,
  brand: {
    "@type": "Organization",
    name: OPERATOR.legalName,
    url: OPERATOR.portfolioUrl,
  },
  sameAs: BID_FAMILY.filter((sibling) => sibling.host !== OPERATOR.siteHost).map((sibling) => sibling.url),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        <NavBar />
        <main className="flex-1">{children}</main>
        <Footer />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
