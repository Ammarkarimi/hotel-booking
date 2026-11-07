import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { withPlatform } from "@/lib/platform";
import { cleanModules } from "@/lib/modules";
import { assertPackageNameFree, listPackages, packageFields } from "@/lib/platform-hotels";

type Params = { params: Promise<{ id: string }> };

/** Changes a package. Every hotel on it gets the new set of modules on its next click. */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const body = z.object(packageFields).partial().parse(await request.json());
    if (!(await rawPrisma.package.findUnique({ where: { id } }))) fail("Package not found", 404);
    if (body.name) await assertPackageNameFree(body.name, id);
    await rawPrisma.package.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.monthlyFee !== undefined && { monthlyFee: body.monthlyFee }),
        ...(body.modules && { modules: cleanModules(body.modules) }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });
    return NextResponse.json(await listPackages());
  });
}

/** Removes a package that no hotel is on. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const pkg = await rawPrisma.package.findUnique({ where: { id }, include: { _count: { select: { hotels: true } } } });
    if (!pkg) fail("Package not found", 404);
    if (pkg._count.hotels > 0) {
      fail(`${pkg._count.hotels} hotel${pkg._count.hotels === 1 ? " is" : "s are"} on ${pkg.name}. Move them to another package first.`);
    }
    await rawPrisma.package.delete({ where: { id } });
    return NextResponse.json(await listPackages());
  });
}
