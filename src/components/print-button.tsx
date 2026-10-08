"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui";

export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
      <Button variant="outline" onClick={() => window.close()}>
        Close
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="h-5 w-5" /> Print / Save as PDF
      </Button>
    </div>
  );
}
