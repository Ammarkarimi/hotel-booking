"use client";

/** Fetch JSON from our API. Throws an Error with a friendly message on failure. */
export async function api<T = unknown>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: options.body && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? (isForm ? (options.body as FormData) : JSON.stringify(options.body)) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Cannot reach the server. Please check your internet connection.");
  }
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/login")) {
    window.location.href = url.startsWith("/api/platform") ? "/platform/login" : "/api/auth/expired";
    throw new Error("Please sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  // The person's shift has ended (for example someone else started theirs): show the start-shift screen.
  if (res.status === 409 && typeof window !== "undefined" && /shift has ended/i.test((data as { error?: string }).error ?? "")) {
    window.dispatchEvent(new Event("shift-changed"));
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong. Please try again.");
  return data as T;
}

export function whatsappLink(phone: string | null | undefined, message: string) {
  let digits = (phone || "").replace(/[^\d]/g, "");
  // WhatsApp needs the bare international number, so drop dialling prefixes people often type.
  if (digits.startsWith("00")) digits = digits.slice(2); // 0091 98765 43210
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1); // 098765 43210
  if (digits.length === 13 && digits.startsWith("910")) digits = `91${digits.slice(3)}`; // +91 098765 43210
  if (digits.length === 10) digits = `91${digits}`; // Indian mobile without country code
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Today's date (YYYY-MM-DD) on this device. */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
