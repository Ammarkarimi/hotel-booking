import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
// The Innvero wordmark (src/components/brand.tsx).
const brand = Bricolage_Grotesque({ subsets: ["latin"], weight: ["800"], variable: "--font-brand" });

export const metadata: Metadata = {
  title: { default: "Innvero", template: "%s · Innvero" },
  description: "Innvero: hotel booking and front-desk software",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2548eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={brand.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
