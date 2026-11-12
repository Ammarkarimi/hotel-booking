import { currentHotelId, prisma, rawPrisma } from "./db";
import { applyModules, resolveModules } from "./modules";
import { parseGstSlabs, type PricingRules, type TaxRules } from "./pricing";
import { todayKey } from "./dates";

/** The current hotel's profile and preferences as the owner saved them (created with defaults on first use). */
export async function getStoredSettings() {
  const hotelId = currentHotelId();
  return prisma.hotelSettings.upsert({
    where: { hotelId },
    update: {},
    create: { hotelId },
  });
}

/** The modules the current hotel's package includes. */
export async function getHotelModules() {
  const hotel = await rawPrisma.hotel.findUniqueOrThrow({
    where: { id: currentHotelId() },
    select: { modules: true, package: { select: { modules: true } } },
  });
  return resolveModules(hotel);
}

/**
 * The current hotel's settings as the software uses them: a feature the package does not
 * include (Pathik, shifts, rate tips, the booking website) reads as switched off.
 * Only the Settings screen reads and writes the stored values (getStoredSettings).
 */
export async function getSettings() {
  const [stored, modules] = await Promise.all([getStoredSettings(), getHotelModules()]);
  return applyModules(stored, modules);
}

export type HotelSettingsRecord = Awaited<ReturnType<typeof getSettings>>;

export function taxRulesFrom(settings: HotelSettingsRecord): TaxRules {
  return {
    taxMode: settings.taxMode,
    taxRate: settings.taxRate,
    gstSlabs: parseGstSlabs(settings.gstSlabs),
    extrasTaxRate: settings.extrasTaxRate,
  };
}

export async function getPricingRules(settings: HotelSettingsRecord): Promise<PricingRules> {
  const seasonalRates = await prisma.seasonalRate.findMany();
  return { weekendSurcharge: settings.weekendSurcharge, seasonalRates };
}

/** Everything needed to price and bill a booking, loaded once per request. */
export async function getBillingContext() {
  const settings = await getSettings();
  const rules = await getPricingRules(settings);
  return { settings, rules, tax: taxRulesFrom(settings), today: todayKey(settings.timezone) };
}

export type BillingContext = Awaited<ReturnType<typeof getBillingContext>>;

/** Settings as they may go to the screens: the Razorpay secret never leaves the server. */
export function screenSettings<T extends { razorpayKeySecret?: string | null }>(settings: T) {
  const { razorpayKeySecret, ...rest } = settings;
  return { ...rest, razorpaySecretSet: !!razorpayKeySecret };
}
