// A small drawing of a hotel building with lit and dark windows, in the Innvela colours.
// Purely decorative (hidden from screen readers). Used on the sign-in pages and the landing page.

import { cn } from "@/lib/utils";

// 1 = lit (guest in), 0 = free, 2 = being cleaned. Top floor first.
const FLOORS = [
  [0, 1, 1, 0],
  [1, 2, 1, 1],
  [1, 1, 0, 1],
  [0, 1, 1, 2],
];

export function BuildingArt({ className, floors = FLOORS }: { className?: string; floors?: number[][] }) {
  return (
    <div aria-hidden="true" className={cn("w-full max-w-sm select-none", className)}>
      <div className="mx-2 h-10 bg-roof [clip-path:polygon(4%_100%,50%_0,96%_100%)]" />
      <div className="space-y-2.5 bg-wall px-4 pb-0 pt-4 ring-1 ring-white/10">
        {floors.map((row, i) => (
          <div key={i} className="grid grid-cols-4 gap-2.5">
            {row.map((w, j) => (
              <span
                key={j}
                className={cn(
                  "h-12 rounded-t-md rounded-b-sm",
                  w === 1 ? "bg-lamp-400" : w === 2 ? "stripes" : "bg-primary-100/90"
                )}
              />
            ))}
          </div>
        ))}
        <div className="grid grid-cols-4 gap-2.5 pt-1">
          <span className="col-span-1 h-12 rounded-t-md bg-primary-100/90" />
          <span className="col-span-2 h-14 self-end rounded-t-lg border-2 border-b-0 border-primary-300 bg-roof" />
          <span className="col-span-1 h-12 rounded-t-md bg-lamp-400" />
        </div>
      </div>
      <div className="h-2.5 rounded-b bg-primary-300" />
    </div>
  );
}
