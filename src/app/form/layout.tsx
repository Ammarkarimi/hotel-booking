import type { Metadata } from "next";

// Each guest's form link is private, so search engines must never list it.
export const metadata: Metadata = {
  title: { absolute: "Guest details" },
  robots: { index: false, follow: false },
};

export default function FormLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
