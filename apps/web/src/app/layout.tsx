import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Source_Serif_4 } from "next/font/google";
import { publicBrand } from "@/lib/brand";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "../styles/tokens.css";
import "../styles/site.css";
import "../styles/base.css";
import "../styles/app.css";

const wordmarkSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  variable: "--font-wordmark-serif",
});

const brand = publicBrand();

export const metadata: Metadata = {
  title: {
    default: brand.appName,
    template: `%s · ${brand.appName}`,
  },
  description: brand.tagline,
  applicationName: brand.appName,
  robots: { index: false, follow: false },
};

function withClerk(node: React.ReactNode) {
  return <ClerkProvider>{node}</ClerkProvider>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${wordmarkSerif.variable}`}
    >
      <body>{withClerk(<Shell>{children}</Shell>)}</body>
    </html>
  );
}
