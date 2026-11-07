// The Innvela logo: a roof over a V. Used on the landing page, sign-in, the menu and the owner panel.
// The same drawing is in src/app/icon.svg (browser tab) and src/app/apple-icon.png (phone home screen).

export const BRAND = "Innvela";

const ROOF = "M10 30L32 12l22 18";
const V = "M19 33l13 19 13-19";

/** The mark alone, without a box. `tone="dark"` is for dark backgrounds. */
export function LogoMark({ className = "h-8 w-8", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d={ROOF} fill="none" stroke={dark ? "#ffffff" : "#3b2350"} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={V} fill="none" stroke={dark ? "#ffcf5a" : "#e0a800"} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The app icon: the mark on a plum rounded square. */
export function LogoIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="#3b2350" />
      <path d="M14 31L32 16l18 15" fill="none" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21.5 34l10.5 15.5L42.5 34" fill="none" stroke="#ffcf5a" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "Inn" + "vela" in the brand colours. */
export function Wordmark({ className = "text-xl", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <span className={"font-extrabold tracking-tight " + className} style={{ fontFamily: "var(--font-brand), var(--font-body), system-ui, sans-serif" }}>
      <span className={dark ? "text-white" : "text-slate-900"}>Inn</span>
      <span style={{ color: dark ? "#ffcf5a" : "#a87a00" }}>vela</span>
    </span>
  );
}

/** Mark and name together. */
export function Logo({
  tone = "light",
  markClassName = "h-8 w-8",
  wordClassName = "text-xl",
  className = "",
}: {
  tone?: "light" | "dark";
  markClassName?: string;
  wordClassName?: string;
  className?: string;
}) {
  return (
    <span className={"inline-flex items-center gap-2 " + className} aria-label={BRAND} role="img">
      <LogoMark className={markClassName} tone={tone} />
      <Wordmark className={wordClassName} tone={tone} />
    </span>
  );
}
