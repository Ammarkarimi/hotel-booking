import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

// Only the Innvela wordmark (src/components/brand.tsx) uses a web font; all other text uses the
// computer's own fonts (Tahoma / Segoe UI, see globals.css), like desktop software.
const brand = Bricolage_Grotesque({ subsets: ["latin"], weight: ["800"], variable: "--font-brand" });

export const metadata: Metadata = {
  title: { default: "Innvela", template: "%s · Innvela" },
  description: "Innvela: hotel booking and front-desk software",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b4f8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={brand.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
