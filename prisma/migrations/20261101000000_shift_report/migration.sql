-- How a shift ended, and its report exactly as saved; how many people can be on shift together.
ALTER TABLE "Shift" ADD COLUMN "endReason" TEXT;
ALTER TABLE "Shift" ADD COLUMN "reportText" TEXT;

-- Shifts ended before this change.
UPDATE "Shift" SET "endReason" = CASE WHEN "endedBy" IS NOT NULL THEN 'owner' ELSE 'staff' END WHERE "endedAt" IS NOT NULL;

ALTER TABLE "HotelSettings" ADD COLUMN "frontDeskStaff" INTEGER NOT NULL DEFAULT 1;
