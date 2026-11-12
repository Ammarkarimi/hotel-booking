// The parts of the software a hotel can have switched on or off by the software provider,
// through the package it is on (or a custom choice). Everything not listed here is part of
// every package: Today, calendar, bookings, check-in and check-out, bills, payments, guests,
// rooms, housekeeping, WhatsApp messages, settings and staff.
// Pure: used by the server and the screens.

export const MODULES = [
  { key: "guest_forms", label: "Express check-in", description: "Guests fill in their own details on WhatsApp before they arrive, so check-in takes a minute." },
  { key: "pathik", label: "Pathik (police guest register)", description: "Fill in the Gujarat police guest register from each booking." },
  { key: "expenses", label: "Expenses", description: "Record money spent: salaries, bills, supplies." },
  { key: "reports", label: "Reports", description: "The owner's business summary, takings, GST and downloads." },
  { key: "shifts", label: "Staff shifts", description: "Front-desk staff start and end shifts, with handover notes and a shift report." },
  { key: "rate_tips", label: "Rate tips", description: "Suggests a lower price for rooms still empty for tonight." },
  { key: "website", label: "Online booking website", description: "The hotel's own page where guests book direct, with no commission." },
  { key: "channel_manager", label: "Channel manager (booking sites)", description: "Keeps free rooms in step with MakeMyTrip, Booking.com, Airbnb and other booking sites, and brings their bookings in." },
] as const;

/** Parts of the software every hotel has, whatever its package. */
export const ALWAYS_INCLUDED =
  "Dashboard, room calendar, bookings, check-in and check-out, bills and GST invoices, payments, guests, ID check, rooms and prices, housekeeping, WhatsApp messages to guests, staff sign-ins and settings.";

export type ModuleKey = (typeof MODULES)[number]["key"];

export const ALL_MODULES: ModuleKey[] = MODULES.map((m) => m.key);

const KEYS = new Set<string>(ALL_MODULES);

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && KEYS.has(value);
}

/** Keeps only known modules, once each, in the order of MODULES. */
export function cleanModules(values: readonly unknown[] | null | undefined): ModuleKey[] {
  const wanted = new Set((values ?? []).filter(isModuleKey));
  return ALL_MODULES.filter((k) => wanted.has(k));
}

export function moduleLabel(key: ModuleKey): string {
  return MODULES.find((m) => m.key === key)?.label ?? key;
}

/** What a hotel can use: its package's modules, or its own custom list when it has no package. */
export function resolveModules(hotel: { modules: readonly string[]; package?: { modules: readonly string[] } | null }): ModuleKey[] {
  return cleanModules(hotel.package ? hotel.package.modules : hotel.modules);
}

/** The screen each module owns. Modules without a screen of their own are not listed. */
const MODULE_PAGES: Array<[string, ModuleKey]> = [
  ["/guest-forms", "guest_forms"],
  ["/expenses", "expenses"],
  ["/reports", "reports"],
  ["/shifts", "shifts"],
  ["/rate-tips", "rate_tips"],
  ["/channels", "channel_manager"],
];

/** The module a signed-in page belongs to, if it belongs to one. */
export function moduleForPath(pathname: string): ModuleKey | null {
  for (const [href, key] of MODULE_PAGES) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return key;
  }
  return null;
}

export function notInPackageMessage(key: ModuleKey): string {
  return `${moduleLabel(key)} is not part of your package. Please contact your software provider to add it.`;
}

/**
 * Settings whose feature is switched off by the package read as off everywhere, while the
 * owner's own choice stays saved for when the module is added back.
 */
export function applyModules<T extends { pathik: boolean; staffShifts: boolean; rateTips: boolean; websiteEnabled: boolean }>(
  settings: T,
  modules: readonly ModuleKey[]
): T {
  const has = (k: ModuleKey) => modules.includes(k);
  return {
    ...settings,
    pathik: settings.pathik && has("pathik"),
    staffShifts: settings.staffShifts && has("shifts"),
    rateTips: settings.rateTips && has("rate_tips"),
    websiteEnabled: settings.websiteEnabled && has("website"),
  };
}

/** The three packages created at the start. The provider can rename them and change what is in them. */
export const STARTER_PACKAGES: Array<{ id: string; name: string; description: string; modules: ModuleKey[] }> = [
  { id: "pkg_basic", name: "Basic", description: "Bookings, billing, rooms and housekeeping, with Pathik.", modules: ["pathik"] },
  { id: "pkg_standard", name: "Standard", description: "Basic, plus express check-in, expenses, reports and staff shifts.", modules: ["guest_forms", "pathik", "expenses", "reports", "shifts"] },
  { id: "pkg_premium", name: "Premium", description: "Everything, including rate tips and the online booking website.", modules: [...ALL_MODULES] },
];
