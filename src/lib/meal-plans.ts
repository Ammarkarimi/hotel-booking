// Meal plans sold with a room: room only, with breakfast, with breakfast and dinner, all meals.
// The owner sets a price per adult and per child per night in Settings; a booking keeps the
// plan's name and what it adds per night for the whole room. Pure: no database code here.
import { round2 } from "./pricing";

export interface MealPlan {
  /** Never changes once made, e.g. "cp". */
  key: string;
  /** What staff and guests see, e.g. "With breakfast (CP)". */
  name: string;
  /** Added per adult per night. */
  adult: number;
  /** Added per child per night. */
  child: number;
}

/** The plans most Indian hotels sell, offered as a starting point in Settings. */
export const SUGGESTED_MEAL_PLANS: MealPlan[] = [
  { key: "cp", name: "With breakfast (CP)", adult: 250, child: 150 },
  { key: "map", name: "Breakfast and dinner (MAP)", adult: 650, child: 400 },
  { key: "ap", name: "All meals (AP)", adult: 1000, child: 600 },
];

export const MAX_MEAL_PLANS = 8;

export function parseMealPlans(raw: string | null | undefined): MealPlan[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return cleanMealPlans(parsed);
  } catch {
    return [];
  }
}

/** Keeps well-formed plans, once per key, at most MAX_MEAL_PLANS. */
export function cleanMealPlans(list: unknown[]): MealPlan[] {
  const seen = new Set<string>();
  const out: MealPlan[] = [];
  for (const item of list) {
    const p = item as Partial<MealPlan> | null;
    const name = typeof p?.name === "string" ? p.name.trim().slice(0, 60) : "";
    if (!name) continue;
    let key = typeof p?.key === "string" && /^[a-z0-9_]{1,30}$/.test(p.key) ? p.key : name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "plan";
    while (seen.has(key)) key = `${key}_2`.slice(0, 30);
    seen.add(key);
    out.push({ key, name, adult: Math.max(0, round2(Number(p?.adult) || 0)), child: Math.max(0, round2(Number(p?.child) || 0)) });
    if (out.length >= MAX_MEAL_PLANS) break;
  }
  return out;
}

/** What a plan adds per night for the whole room. */
export function mealRateFor(plan: Pick<MealPlan, "adult" | "child">, adults: number, children: number): number {
  return round2(plan.adult * Math.max(0, adults) + plan.child * Math.max(0, children));
}
