import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { withPlatform } from "@/lib/platform";
import { cleanModules } from "@/lib/modules";
import { assertPackageNameFree, listPackages, packageFields } from "@/lib/platform-hotels";

export async function GET() {
  return withPlatform(async () => NextResponse.json(await listPackages()));
}

/** Adds a package. It starts with no hotels on it. */
export async function POST(request: NextRequest) {
  return withPlatform(async () => {
    const body = z.object(packageFields).parse(await request.json());
    await assertPackageNameFree(body.name);
    const last = await rawPrisma.package.aggregate({ _max: { sortOrder: true } });
    await rawPrisma.package.create({
      data: {
        name: body.name,
        description: body.description || null,
        monthlyFee: body.monthlyFee,
        modules: cleanModules(body.modules),
        sortOrder: body.sortOrder ?? (last._max.sortOrder ?? 0) + 1,
      },
    });
    return NextResponse.json(await listPackages(), { status: 201 });
  });
}
