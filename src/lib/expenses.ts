import { z } from "zod";
import type { Expense } from "@prisma/client";
import { fail, isAdmin } from "./api";
import { addDays, isDateKey, todayKey, toDateKey } from "./dates";
import type { SessionUser } from "./session";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "./utils";

export const expenseSchema = z.object({
  date: z.string().refine(isDateKey, "Please choose the date"),
  category: z.enum(EXPENSE_CATEGORIES, { errorMap: () => ({ message: "Please choose what kind of cost this is" }) }),
  title: z.string().trim().min(1, "Please write what the money was spent on").max(120, "Please keep the title under 120 letters"),
  description: z.string().trim().max(1000, "Please keep the notes under 1000 letters").optional().default(""),
  amount: z.coerce.number().positive("The amount must be more than zero").max(100_000_000, "Please check the amount"),
  method: z.enum(PAYMENT_METHODS).default("cash"),
});

/** Front-desk staff may write down costs from the last week; the owner can use any past date. */
export function checkExpenseDate(date: string, today: string, user: SessionUser) {
  if (date > today) fail("The date cannot be in the future");
  if (!isAdmin(user) && date < addDays(today, -7)) fail("Front desk can add costs from the last 7 days only. Ask the owner for older ones.");
}

/** The owner can change any expense; staff only fix their own entries on the day they wrote them. */
export function canChangeExpense(user: SessionUser, expense: Pick<Expense, "addedById" | "createdAt">, timezone: string, today: string) {
  if (isAdmin(user)) return true;
  return expense.addedById === user.id && todayKey(timezone, expense.createdAt) === today;
}

export function serializeExpense(e: Expense, canEdit: boolean) {
  return { ...e, date: toDateKey(e.date), canEdit };
}

export type ExpenseRow = ReturnType<typeof serializeExpense>;
