import type { Metadata } from "next";

export const metadata: Metadata = { title: "Day sheet" };

export default function DaySheetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
