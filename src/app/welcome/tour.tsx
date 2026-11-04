"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

// Chapter start times (seconds) in public/welcome/hotel-manager-tour.mp4.
export const CHAPTERS = [
  { t: 0, title: "Guests book on your own website" },
  { t: 17.3, title: "Staff start their shift" },
  { t: 26.9, title: "Your whole day on one screen" },
  { t: 34.4, title: "Guest forms on WhatsApp" },
  { t: 44, title: "The guest fills it in on their phone" },
  { t: 60, title: "Check the form, then book" },
  { t: 81.4, title: "A walk-in guest in under a minute" },
  { t: 95.7, title: "See every room at a glance" },
  { t: 107.4, title: "Check each guest's ID by hand" },
  { t: 118.7, title: "Check in with one tap" },
  { t: 129, title: "Add food, laundry and extras" },
  { t: 140.8, title: "Check out and take payment" },
  { t: 153.8, title: "A GST invoice in one tap" },
  { t: 158.6, title: "Housekeeping from any phone" },
  { t: 168, title: "Write down every expense" },
  { t: 175, title: "Count the cash drawer in seconds" },
  { t: 180.8, title: "End the shift with a code" },
  { t: 197.9, title: "Rate tips for tonight's empty rooms" },
  { t: 209.1, title: "The Rate tips page" },
  { t: 216.3, title: "Use the tip when you book" },
  { t: 228.3, title: "WhatsApp messages in your own words" },
  { t: 251, title: "Booking-site payouts" },
  { t: 264.1, title: "Your profit, day by day" },
  { t: 274.1, title: "Staff shifts and reports" },
  { t: 285.1, title: "Your prices, GST and staff" },
];

const PLAY_EVENT = "welcome:play-tour";

function timeLabel(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Button anywhere on the page that scrolls to the tour and starts it. */
export function PlayTourButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        document.getElementById("tour")?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.dispatchEvent(new Event(PLAY_EVENT));
      }}
    >
      {children}
    </button>
  );
}

export function TourPlayer() {
  const video = useRef<HTMLVideoElement>(null);
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const list = useRef<HTMLOListElement>(null);

  // Keep the chapter that is playing in view inside the list (without scrolling the page).
  useEffect(() => {
    const ol = list.current;
    const li = ol?.children[current] as HTMLElement | undefined;
    if (!ol || !li || !started) return;
    if (li.offsetTop < ol.scrollTop || li.offsetTop + li.offsetHeight > ol.scrollTop + ol.clientHeight) {
      ol.scrollTo({ top: li.offsetTop - ol.clientHeight / 3, behavior: "smooth" });
    }
  }, [current, started]);

  function playFrom(seconds: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = seconds;
    setStarted(true);
    void v.play().catch(() => undefined);
  }

  useEffect(() => {
    const onPlay = () => {
      const v = video.current;
      if (!v) return;
      v.currentTime = 0;
      setStarted(true);
      void v.play().catch(() => undefined);
    };
    window.addEventListener(PLAY_EVENT, onPlay);
    return () => window.removeEventListener(PLAY_EVENT, onPlay);
  }, []);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
        <video
          ref={video}
          className="aspect-video w-full"
          poster="/welcome/tour-poster.webp"
          controls={started}
          playsInline
          preload="metadata"
          onPlay={() => setStarted(true)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            let index = 0;
            CHAPTERS.forEach((c, i) => {
              if (t >= c.t) index = i;
            });
            setCurrent(index);
          }}
        >
          {/* MP4 (H.264) for Safari, iPhone and Chrome; WebM (VP9) for browsers without H.264. */}
          <source src="/welcome/hotel-manager-tour.mp4" type='video/mp4; codecs="avc1.64001F"' />
          <source src="/welcome/hotel-manager-tour.webm" type='video/webm; codecs="vp9"' />
          A video tour of Hotel Manager.
        </video>
        {!started && (
          <button
            type="button"
            onClick={() => playFrom(0)}
            className="group absolute inset-0 flex items-center justify-center bg-slate-950/35 transition hover:bg-slate-950/25"
            aria-label="Play the 5-minute tour"
          >
            <span className="flex items-center gap-3 rounded-full bg-white px-6 py-4 text-lg font-bold text-slate-900 shadow-xl transition group-hover:scale-105">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white">
                <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
              </span>
              Play the tour · 4:53
            </span>
          </button>
        )}
      </div>

      <ol ref={list} className="relative grid max-h-80 content-start gap-1.5 overflow-y-auto overscroll-contain pr-1 lg:max-h-[min(30rem,70vh)]" aria-label="Chapters">
        {CHAPTERS.map((c, i) => (
          <li key={c.t}>
            <button
              type="button"
              onClick={() => playFrom(c.t)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] transition",
                started && current === i ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              aria-current={started && current === i ? "step" : undefined}
            >
              <span
                className={cn(
                  "w-11 shrink-0 font-mono text-xs tabular-nums",
                  started && current === i ? "text-primary-600" : "text-slate-500"
                )}
              >
                {timeLabel(c.t)}
              </span>
              <span className="font-medium">{c.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
