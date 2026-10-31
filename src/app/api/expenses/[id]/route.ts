import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { dateFromKey, toDateKey } from "@/lib/dates";
import { canChangeExpense, checkExpenseDate, expenseSchema, serializeExpense } from "@/lib/expenses";
import { logActivity } from "@/lib/activity";
import { formatCurrency, label } from "@/lib/utils";
import { assertOnShift } from "@/lib/shift-api";

type Params = { params: Promise<{ id: string }> };

async function loadForChange(id: string, user: Parameters<typeof canChangeExpense>[0]) {
  const ctx = await getBillingContext();
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) fail("Expense not found", 404);
  if (!canChangeExpense(user, expense, ctx.settings.timezone, ctx.today)) {
    fail("Only the owner / manager can change this. Front desk can fix their own entries on the same day.", 403);
  }
  return { ctx, expense };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const body = expenseSchema.parse(await request.json());
    const { ctx, expense } = await loadForChange(id, user);
    if (body.date !== toDateKey(expense.date)) checkExpenseDate(body.date, ctx.today, user);
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        date: dateFromKey(body.date),
        category: body.category,
        title: body.title,
        description: body.description || null,
        amount: body.amount,
        method: body.method,
      },
    });
    await logActivity(user, "Expense changed", `${body.title} (${label(body.category)}): ${formatCurrency(body.amount, ctx.settings.currency)}`);
    return NextResponse.json(serializeExpense(updated, true));
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const { ctx, expense } = await loadForChange(id, user);
    await prisma.expense.delete({ where: { id } });
    await logActivity(user, "Expense deleted", `${expense.title}: ${formatCurrency(expense.amount, ctx.settings.currency)} on ${toDateKey(expense.date)}`);
    return NextResponse.json({ success: true });
  });
}
