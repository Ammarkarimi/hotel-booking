// Front-desk shifts: who worked when, what they did, and the note they left for the next person.
import { prisma } from "./db";
import { summarize, type ShiftSummary } from "./shift-report";

export * from "./shift-report";

/** What a staff member has done between two moments (the shift so far, or the whole shift). */
export async function shiftSummary(staff: { id: string | null; name: string }, from: Date, to: Date): Promise<ShiftSummary> {
  const range = { gte: from, lte: to };
  const [activities, payments, expenses] = await Promise.all([
    staff.id
      ? prisma.activityLog.findMany({ where: { staffId: staff.id, createdAt: range }, select: { action: true, details: true }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    prisma.payment.findMany({ where: { receivedBy: staff.name, status: "completed", createdAt: range }, select: { amount: true, method: true, type: true } }),
    staff.id
      ? prisma.expense.findMany({ where: { addedById: staff.id, method: "cash", createdAt: range }, select: { amount: true } })
      : Promise.resolve([]),
  ]);
  return summarize({ actions: activities, payments, cashExpenses: expenses.map((e) => e.amount) });
}

export function parseSummary(raw: string | null | undefined): ShiftSummary | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShiftSummary;
  } catch {
    return null;
  }
}
