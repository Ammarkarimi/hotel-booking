import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { withAuth, fail, isAdmin } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { addDays, dateFromKey, isDateKey } from "@/lib/dates";
import { canChangeExpense, checkExpenseDate, expenseSchema, serializeExpense } from "@/lib/expenses";
import { logActivity } from "@/lib/activity";
import { EXPENSE_CATEGORIES, formatCurrency, label } from "@/lib/utils";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const { searchParams } = new URL(request.url);
    const ctx = await getBillingContext();
    const to = isDateKey(searchParams.get("to")) ? searchParams.get("to")! : ctx.today;
    const from = isDateKey(searchParams.get("from")) ? searchParams.get("from")! : `${to.slice(0, 7)}-01`;
    if (to < from) fail("The end date must be after the start date");
    const where: Prisma.ExpenseWhereInput = { date: { gte: dateFromKey(from), lt: dateFromKey(addDays(to, 1)) } };

    // Cash paid out of the drawer, for counting the cash at the end of a shift. Everyone may see this total.
    if (searchParams.get("summary") === "cash") {
      const sum = await prisma.expense.aggregate({ where: { ...where, method: "cash" }, _sum: { amount: true }, _count: true });
      return NextResponse.json({ cashSpent: sum._sum.amount ?? 0, count: sum._count });
    }

    const category = searchParams.get("category");
    if (category && (EXPENSE_CATEGORIES as readonly string[]).includes(category)) where.category = category;
    // Front desk sees only what they wrote down; salaries and other costs stay with the owner.
    if (!isAdmin(user)) where.addedById = user.id;

    const expenses = await prisma.expense.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 2000 });
    const tz = ctx.settings.timezone;
    return NextResponse.json(expenses.map((e) => serializeExpense(e, canChangeExpense(user, e, tz, ctx.today))));
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = expenseSchema.parse(await request.json());
    const ctx = await getBillingContext();
    checkExpenseDate(body.date, ctx.today, user);
    const expense = await prisma.expense.create({
      data: {
        hotelId: currentHotelId(),
        date: dateFromKey(body.date),
        category: body.category,
        title: body.title,
        description: body.description || null,
        amount: body.amount,
        method: body.method,
        addedById: user.id,
        addedBy: user.name,
      },
    });
    await logActivity(user, "Expense added", `${body.title} (${label(body.category)}): ${formatCurrency(body.amount, ctx.settings.currency)}`);
    return NextResponse.json(serializeExpense(expense, true), { status: 201 });
  });
}
