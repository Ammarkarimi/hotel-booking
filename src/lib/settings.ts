import { prisma } from "./db";
import { parseGstSlabs, type PricingRules, type TaxRules } from "./pricing";
import { todayKey } from "./dates";

export async function getSettings() {
  return prisma.hotelSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
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
