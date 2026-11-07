import type { Metadata, Viewport } from "next";
import { Figtree, Gabarito } from "next/font/google";
import "./globals.css";

// Reading face for all text.
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });
// The Innvela wordmark (src/components/brand.tsx) and every heading (globals.css).
const brand = Gabarito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-brand" });

export const metadata: Metadata = {
  title: { default: "Innvela", template: "%s · Innvela" },
  description: "Innvela: hotel booking and front-desk software",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3b2350",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${brand.variable} ${body.variable}`}>
      <body className={body.className}>{children}</body>
    </html>
  );
}
