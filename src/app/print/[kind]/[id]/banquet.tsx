// Banquet prints: the quotation / confirmation / tax invoice for the customer, and the function sheet for the staff.
import type { HotelSettingsRecord } from "@/lib/settings";
import type { SerializedBanquet } from "@/lib/banquets";
import { amountInWords } from "@/lib/words";
import { todayKey } from "@/lib/dates";
import { formatDate, formatDateTime, label } from "@/lib/utils";

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function Header({ s, title, subtitle }: { s: HotelSettingsRecord; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
      <div>
        <h1 className="text-2xl font-bold">{s.hotelName}</h1>
        {s.tagline && <p className="text-sm text-slate-600">{s.tagline}</p>}
        <p className="mt-1 text-sm text-slate-700">{[s.address, s.city].filter(Boolean).join(", ")}</p>
        <p className="text-sm text-slate-700">{[s.phone, s.email].filter(Boolean).join(" · ")}</p>
        {s.gstin && <p className="text-sm font-semibold">GSTIN: {s.gstin}</p>}
      </div>
      <div className="text-right">
        <p className="text-xl font-bold uppercase tracking-wide">{title}</p>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
    </div>
  );
}

function Info({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="w-32 shrink-0 text-slate-500">{l}</span>
      <span className="font-medium">{children || "—"}</span>
    </div>
  );
}

// SAC codes: 996334 banquet / catering with food, 997212 hall rent, 9997 other services.
const SAC_FOOD = "996334";
const SAC_HALL = "997212";
const SAC_OTHER = "9997";

/** Quotation (enquiry), booking confirmation (on hold / confirmed) or tax invoice (after the final bill). */
export function BanquetBillPrint({ b, s }: { b: SerializedBanquet; s: HotelSettingsRecord }) {
  const f = b.bill;
  const cur = s.currency;
  const final = !!b.invoiceNumber;
  const title = final ? "Tax Invoice" : b.status === "enquiry" ? "Quotation" : b.status === "cancelled" ? "Cancelled function" : "Function Confirmation";
  const half = (n: number) => Math.round((n / 2) * 100) / 100;
  return (
    <>
      <Header s={s} title={title} subtitle={final ? `No. ${b.invoiceNumber}` : `Function #${b.number}${final ? "" : " · not a tax invoice"}`} />
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">{final ? "Billed to" : "For"}</p>
          <p className="font-semibold">{b.company || b.customerName}</p>
          {b.company && <p className="text-sm">Contact: {b.customerName}</p>}
          {b.address && <p className="text-sm">{b.address}</p>}
          <p className="text-sm">{b.phone}</p>
          {b.gstin && <p className="text-sm font-semibold">GSTIN: {b.gstin}</p>}
        </div>
        <div>
          <Info label={final ? "Invoice date" : "Date"}>{formatDate(final && b.billedAt ? todayKey(s.timezone, b.billedAt) : todayKey(s.timezone))}</Info>
          <Info label="Function">
            {label(b.eventType)}
            {b.eventName ? ` – ${b.eventName}` : ""}
          </Info>
          <Info label="Hall">{b.hall.name}</Info>
          <Info label="Function date">{formatDate(b.eventDate)}</Info>
          <Info label="Time">
            {b.startTime} – {b.endTime} ({label(b.session)})
          </Info>
          <Info label="Guests">
            {b.actualPax !== null ? `${b.actualPax} served` : `${b.expectedPax} expected`}
            {b.guaranteedPax ? `, ${b.guaranteedPax} guaranteed` : ""}
          </Info>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-800 text-left">
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2">SAC</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Rate</th>
            <th className="py-2 pr-2 text-right">GST</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {f.food > 0 && (
            <tr className="border-b border-slate-200">
              <td className="py-2 pr-2">
                Food{b.menuName ? `: ${b.menuName}` : ""} ({label(b.foodType)}, per plate)
              </td>
              <td className="py-2 pr-2">{SAC_FOOD}</td>
              <td className="py-2 pr-2 text-right">{f.billedPax}</td>
              <td className="py-2 pr-2 text-right">{money(b.platePrice, cur)}</td>
              <td className="py-2 pr-2 text-right">{b.foodGst}%</td>
              <td className="py-2 text-right">{money(f.food, cur)}</td>
            </tr>
          )}
          {f.hall > 0 && (
            <tr className="border-b border-slate-200">
              <td className="py-2 pr-2">Hall rent: {b.hall.name}</td>
              <td className="py-2 pr-2">{SAC_HALL}</td>
              <td className="py-2 pr-2 text-right">1</td>
              <td className="py-2 pr-2 text-right">{money(f.hall, cur)}</td>
              <td className="py-2 pr-2 text-right">{b.hallGst}%</td>
              <td className="py-2 text-right">{money(f.hall, cur)}</td>
            </tr>
          )}
          {b.items.map((i) => (
            <tr key={i.id} className="border-b border-slate-200">
              <td className="py-2 pr-2">
                {i.description} <span className="text-xs text-slate-500">({label(i.category)})</span>
              </td>
              <td className="py-2 pr-2">{["extra_plates", "drinks"].includes(i.category) ? SAC_FOOD : SAC_OTHER}</td>
              <td className="py-2 pr-2 text-right">{i.quantity}</td>
              <td className="py-2 pr-2 text-right">{money(i.unitPrice, cur)}</td>
              <td className="py-2 pr-2 text-right">{i.gstRate}%</td>
              <td className="py-2 text-right">{money(i.amount, cur)}</td>
            </tr>
          ))}
          {f.discount > 0 && (
            <tr className="border-b border-slate-200">
              <td className="py-2 pr-2" colSpan={5}>
                Less: discount
              </td>
              <td className="py-2 text-right">− {money(f.discount, cur)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <table className="w-96 text-sm">
          <tbody>
            <tr>
              <td className="py-1">Taxable value</td>
              <td className="py-1 text-right">{money(f.taxable, cur)}</td>
            </tr>
            {f.taxLines
              .filter((l) => l.tax > 0)
              .map((l) => (
                <tr key={l.rate}>
                  <td className="py-1">
                    CGST @ {l.rate / 2}% + SGST @ {l.rate / 2}% on {money(l.taxable, cur)}
                  </td>
                  <td className="py-1 text-right">
                    {money(half(l.tax), cur)} + {money(l.tax - half(l.tax), cur)}
                  </td>
                </tr>
              ))}
            <tr className="border-y border-slate-800 text-base font-bold">
              <td className="py-2">Total</td>
              <td className="py-2 text-right">{money(f.total, cur)}</td>
            </tr>
            {f.netPaid > 0 && (
              <tr>
                <td className="py-1">{final ? "Paid" : "Advance received"}</td>
                <td className="py-1 text-right">{money(f.netPaid, cur)}</td>
              </tr>
            )}
            {b.status !== "cancelled" && f.balance >= 0.5 && (
              <tr className="font-bold">
                <td className="py-1">Balance due</td>
                <td className="py-1 text-right">{money(f.balance, cur)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm">
        <span className="text-slate-500">Amount in words:</span> <b>{amountInWords(f.total, cur)}</b>
      </p>
      {!final && b.status === "enquiry" && b.followUpOn && <p className="mt-2 text-sm">This quotation is valid until {formatDate(b.followUpOn)}.</p>}
      {!final && b.status === "tentative" && b.followUpOn && <p className="mt-2 text-sm">The hall is held for you until {formatDate(b.followUpOn)}.</p>}
      {/* With money given back the invoice shows only what was finally paid (the list stays in the app). */}
      {b.payments.length > 0 && !b.payments.some((p) => p.type === "refund") && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">Payments received</p>
          <table className="w-full text-sm">
            <tbody>
              {b.payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1">{formatDateTime(p.paidAt, s.timezone)}</td>
                  <td className="py-1">
                    {label(p.type)} · {label(p.method)} {p.reference && `(${p.reference})`}
                  </td>
                  <td className="py-1 text-right">{money(p.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!final && s.banquetTerms && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">Terms</p>
          <p className="whitespace-pre-line text-sm text-slate-700">{s.banquetTerms}</p>
        </div>
      )}
      <div className="mt-16 flex justify-between text-sm">
        <div className="w-56 border-t border-slate-400 pt-1 text-center">Customer signature</div>
        <div className="w-56 border-t border-slate-400 pt-1 text-center">For {s.hotelName}</div>
      </div>
    </>
  );
}

/** For the kitchen, service and decoration staff: what, where, when, how many and the menu. No prices. */
export function FunctionSheet({ b, s }: { b: SerializedBanquet; s: HotelSettingsRecord }) {
  const services = b.items.filter((i) => !["damage"].includes(i.category));
  return (
    <>
      <Header s={s} title="Function Sheet" subtitle={`Function #${b.number} · ${label(b.status)}`} />
      <div className="mt-4 grid grid-cols-2 gap-x-8">
        <div>
          <Info label="Function">
            {label(b.eventType)}
            {b.eventName ? ` – ${b.eventName}` : ""}
          </Info>
          <Info label="Host">
            {b.customerName} · {b.phone}
          </Info>
          {b.company && <Info label="Company">{b.company}</Info>}
          <Info label="Hall">{b.hall.name}</Info>
          <Info label="Seating">{b.seating ? label(b.seating) : ""}</Info>
        </div>
        <div>
          <Info label="Date">{formatDate(b.eventDate)}</Info>
          <Info label="Time">
            {b.startTime} – {b.endTime} ({label(b.session)})
          </Info>
          <Info label="Guests expected">{b.expectedPax}</Info>
          <Info label="Plates to prepare">{Math.max(b.expectedPax, b.guaranteedPax)}</Info>
          <Info label="Food">{label(b.foodType)}</Info>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-slate-300 p-4">
        <p className="mb-2 text-xs font-bold uppercase text-slate-500">Menu{b.menuName ? `: ${b.menuName}` : ""}</p>
        {b.menuItems ? <p className="whitespace-pre-line text-sm">{b.menuItems}</p> : <p className="text-sm text-slate-500">Not written yet.</p>}
      </div>
      {services.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-300 p-4">
          <p className="mb-2 text-xs font-bold uppercase text-slate-500">Extra items and services</p>
          <ul className="list-disc pl-5 text-sm">
            {services.map((i) => (
              <li key={i.id}>
                {i.description} ({label(i.category)}){i.quantity !== 1 ? ` × ${i.quantity}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {b.requirements && (
        <div className="mt-4 rounded-lg border border-slate-300 p-4">
          <p className="mb-2 text-xs font-bold uppercase text-slate-500">Requirements</p>
          <p className="whitespace-pre-line text-sm">{b.requirements}</p>
        </div>
      )}
      {b.notes && (
        <div className="mt-4 rounded-lg border border-slate-300 p-4">
          <p className="mb-2 text-xs font-bold uppercase text-slate-500">Notes</p>
          <p className="whitespace-pre-line text-sm">{b.notes}</p>
        </div>
      )}
      <div className="mt-16 grid grid-cols-3 gap-6 text-sm">
        <div className="border-t border-slate-400 pt-1 text-center">Kitchen</div>
        <div className="border-t border-slate-400 pt-1 text-center">Banquet / service</div>
        <div className="border-t border-slate-400 pt-1 text-center">Manager</div>
      </div>
    </>
  );
}
