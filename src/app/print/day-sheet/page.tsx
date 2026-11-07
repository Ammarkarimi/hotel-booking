"use client";

// The day sheet: print it each morning (or send it on WhatsApp) so the desk can carry on
// on paper if the power or internet goes. It reads the Dashboard's data, so when the internet
// is down it still opens from the copy saved on this computer.
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { api, whatsappLink } from "@/lib/client";
import { daySheet, daySheetText, freeRoomText, leavesText, nightsOf, type DaySheetData } from "@/lib/day-sheet";
import { formatCurrency, formatDate, formatDateTime, setCurrency } from "@/lib/utils";

type Data = DaySheetData & { currency: string; ownerWhatsapp: string | null; offlineSavedAt?: string };

const TH = "border border-slate-400 bg-slate-100 px-1.5 py-1 text-left text-[11px] font-bold";
const TD = "border border-slate-400 px-1.5 py-1 text-[12px] align-top";
const BLANK_ROWS = 10;

function timeNow() {
  return new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export default function DaySheetPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [at, setAt] = useState("");

  const load = useCallback(() => {
    setError("");
    api<Data>("/api/dashboard")
      .then((d) => {
        setCurrency(d.currency);
        setData(d);
        setAt(d.offlineSavedAt ? formatDateTime(d.offlineSavedAt) : timeNow());
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-center text-sm text-slate-700">
        {error ? (
          <div className="mx-auto max-w-md space-y-3 border border-slate-300 bg-white p-4">
            <p>{error}</p>
            <p className="text-slate-500">The day sheet opens without internet only after it has been opened once on this computer while online.</p>
            <Button onClick={load}>Try again</Button>
          </div>
        ) : (
          "Loading the day sheet..."
        )}
      </div>
    );
  }

  const s = daySheet(data);
  const text = daySheetText(data, at);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <Button variant="outline" onClick={() => window.close()}>
          Close
        </Button>
        <div className="flex flex-wrap gap-2">
          <a href={whatsappLink(data.ownerWhatsapp, text)} target="_blank" rel="noreferrer">
            <Button variant="outline" title={data.ownerWhatsapp ? "Sends to the owner's WhatsApp number in Settings" : "Choose who to send it to in WhatsApp"}>
              <MessageCircle className="h-5 w-5" /> Send on WhatsApp
            </Button>
          </a>
          <Button onClick={() => window.print()}>
            <Printer className="h-5 w-5" /> Print
          </Button>
        </div>
      </div>

      {data.offlineSavedAt && (
        <p role="alert" className="no-print mx-auto mt-4 max-w-3xl border border-amber-400 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
          <b>No internet.</b> This is the copy saved at {formatDateTime(data.offlineSavedAt)}. Anything entered after that is not on it.
        </p>
      )}

      <div className="overflow-x-auto px-2 sm:px-4">
        <div className="print-page mx-auto my-4 min-w-[640px] max-w-3xl bg-white p-6 text-slate-900 shadow sm:p-8">
          <div className="flex items-end justify-between border-b-2 border-slate-900 pb-1">
            <div>
              <p className="text-lg font-bold">{data.hotelName}</p>
              <p className="text-sm">Day sheet: {formatDate(data.today)}</p>
            </div>
            <p className="text-[11px] text-slate-600">As at {at}</p>
          </div>

          <Section title={`In the hotel (${s.staying.length})`}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Room</th>
                  <th className={TH}>Guest</th>
                  <th className={TH}>Phone</th>
                  <th className={TH}>People</th>
                  <th className={TH}>Came</th>
                  <th className={TH}>Leaves</th>
                  <th className={`${TH} text-right`}>Due</th>
                </tr>
              </thead>
              <tbody>
                {s.staying.length === 0 && (
                  <tr>
                    <td className={TD} colSpan={7}>No guests in.</td>
                  </tr>
                )}
                {s.staying.map((b) => (
                  <tr key={b.number}>
                    <td className={`${TD} font-bold`}>{b.room.roomNumber}</td>
                    <td className={TD}>{b.guestName}</td>
                    <td className={TD}>{b.guest.phone}</td>
                    <td className={TD}>{b.adults + b.children}</td>
                    <td className={TD}>{formatDate(b.checkInDate)}</td>
                    <td className={`${TD} ${b.checkOutDate <= data.today ? "font-bold" : ""}`}>{leavesText(b, data.today)}</td>
                    <td className={`${TD} text-right`}>{b.folio.balance > 0.5 ? formatCurrency(b.folio.balance) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title={`Arriving today (${s.arriving.length})`}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Booking</th>
                  <th className={TH}>Guest</th>
                  <th className={TH}>Phone</th>
                  <th className={TH}>Room</th>
                  <th className={TH}>People</th>
                  <th className={TH}>Nights</th>
                  <th className={`${TH} text-right`}>Due</th>
                </tr>
              </thead>
              <tbody>
                {s.arriving.length === 0 && (
                  <tr>
                    <td className={TD} colSpan={7}>No arrivals.</td>
                  </tr>
                )}
                {s.arriving.map((b) => (
                  <tr key={b.number}>
                    <td className={TD}>#{b.number}</td>
                    <td className={TD}>{b.guestName}</td>
                    <td className={TD}>{b.guest.phone}</td>
                    <td className={`${TD} font-bold`}>{b.room.roomNumber}</td>
                    <td className={TD}>{b.adults + b.children}</td>
                    <td className={TD}>{nightsOf(b)}</td>
                    <td className={`${TD} text-right`}>{b.folio.balance > 0.5 ? formatCurrency(b.folio.balance) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <SectionTitle>Free tonight ({s.free.length})</SectionTitle>
              <p className="text-[12px]">
                {s.free.length ? s.free.map(freeRoomText).join(", ") : "None."}
              </p>
              {s.notUsable.length > 0 && <p className="mt-1 text-[12px]">Not usable: {s.notUsable.join(", ")}</p>}
            </div>
            <div>
              <SectionTitle>Money</SectionTitle>
              <table className="w-full text-[12px]">
                <tbody>
                  <tr>
                    <td>Received today so far</td>
                    <td className="text-right font-bold">{formatCurrency(s.collectedToday)}</td>
                  </tr>
                  <tr>
                    <td>Still to collect</td>
                    <td className="text-right font-bold">{formatCurrency(s.owed)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Section title="Written by hand (enter these in the software when it is back)">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${TH} w-14`}>Time</th>
                  <th className={`${TH} w-12`}>Room</th>
                  <th className={TH}>Guest</th>
                  <th className={`${TH} w-24`}>Phone</th>
                  <th className={TH}>What happened</th>
                  <th className={`${TH} w-20`}>Amount</th>
                  <th className={`${TH} w-16`}>Staff</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: BLANK_ROWS }, (_, i) => (
                  <tr key={i} className="h-7">
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j} className={TD} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-slate-600">For example: checked in, checked out, paid cash, room changed, extra bed.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[13px] font-bold">{children}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}
