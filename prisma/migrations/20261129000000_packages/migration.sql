-- Packages: which modules a hotel can use.
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modules" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Package_name_key" ON "Package"("name");

-- Hotels that already exist keep every module (no package, everything switched on).
ALTER TABLE "Hotel" ADD COLUMN "packageId" TEXT,
ADD COLUMN "modules" TEXT[] DEFAULT ARRAY['guest_forms', 'pathik', 'expenses', 'reports', 'shifts', 'rate_tips', 'website']::TEXT[];

ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The three packages to start with. The provider renames them and changes what is in them in /platform/packages.
INSERT INTO "Package" ("id", "name", "description", "modules", "sortOrder", "updatedAt") VALUES
  ('pkg_basic', 'Basic', 'Bookings, billing, rooms and housekeeping, with Pathik.', ARRAY['pathik']::TEXT[], 1, CURRENT_TIMESTAMP),
  ('pkg_standard', 'Standard', 'Basic, plus guest forms on WhatsApp, expenses, reports and staff shifts.', ARRAY['guest_forms', 'pathik', 'expenses', 'reports', 'shifts']::TEXT[], 2, CURRENT_TIMESTAMP),
  ('pkg_premium', 'Premium', 'Everything, including rate tips and the online booking website.', ARRAY['guest_forms', 'pathik', 'expenses', 'reports', 'shifts', 'rate_tips', 'website']::TEXT[], 3, CURRENT_TIMESTAMP);
