import { getSettings } from "@/lib/settings";
import { handleError } from "@/lib/api";
import { noStore, publicHotel, roomTypeSummaries } from "@/lib/public";
import { todayKey } from "@/lib/dates";

export async function GET() {
  try {
    const settings = await getSettings();
    return noStore({ ...publicHotel(settings), today: todayKey(settings.timezone), roomTypes: await roomTypeSummaries() });
  } catch (error) {
    return handleError(error);
  }
}
