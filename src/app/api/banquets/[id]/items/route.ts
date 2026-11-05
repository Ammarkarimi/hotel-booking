import { NextRequest, NextResponse } from "next/server";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, isAdmin, withAuth } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { round2 } from "@/lib/pricing";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { banquetItemSchema } from "@/lib/banquet-api";
import { banquetLabel, loadBanquet, serializeBanquet, type FullBanquet } from "@/lib/banquets";
import { label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

/** Items can be added or taken off until the final bill; after it only by the owner. */
function assertCanChange(b: FullBanquet, user: SessionUser) {
  if (b.status === "cancelled") fail("This function is cancelled");
  if (b.status === "completed" && !isAdmin(user)) fail("Only the owner can change a function after its final bill", 403);
}

/** Adds an extra item to the function's bill: decoration, DJ, extra plates, drinks… */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const item = banquetItemSchema.parse(await request.json());
    const banquet = await loadBanquet(id);
    assertCanChange(banquet, user);
    await prisma.banquetItem.create({ data: { hotelId: currentHotelId(), banquetId: id, ...item, amount: round2(item.quantity * item.unitPrice) } });
    await logActivity(user, "Function item added", `${banquetLabel(banquet)}: ${item.description} (${label(item.category)}) ${item.quantity} × ${item.unitPrice}`);
    return NextResponse.json(serializeBanquet(await loadBanquet(id)), { status: 201 });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const itemId = new URL(request.url).searchParams.get("itemId");
    const banquet = await loadBanquet(id);
    assertCanChange(banquet, user);
    const item = banquet.items.find((i) => i.id === itemId);
    if (!item) fail("Item not found", 404);
    await prisma.banquetItem.delete({ where: { id: item.id } });
    await logActivity(user, "Function item removed", `${banquetLabel(banquet)}: ${item.description} ${item.amount}`);
    return NextResponse.json(serializeBanquet(await loadBanquet(id)));
  });
}
