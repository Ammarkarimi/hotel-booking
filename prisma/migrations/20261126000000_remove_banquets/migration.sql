-- Banquets removed: the hotels use other software for halls and functions.
-- Takes out everything 20261125000000_banquets added. Payments are room payments again.

-- Banquet payments go with the banquets
DELETE FROM "Payment" WHERE "banquetId" IS NOT NULL;

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_one_owner";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_banquetId_fkey";
DROP INDEX IF EXISTS "Payment_banquetId_idx";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "banquetId";
ALTER TABLE "Payment" ALTER COLUMN "bookingId" SET NOT NULL;

DROP TABLE IF EXISTS "BanquetItem";
DROP TABLE IF EXISTS "Banquet";
DROP TABLE IF EXISTS "BanquetMenu";
DROP TABLE IF EXISTS "BanquetHall";

ALTER TABLE "HotelSettings" DROP COLUMN IF EXISTS "banquetFoodGst",
DROP COLUMN IF EXISTS "banquetHallGst",
DROP COLUMN IF EXISTS "banquetItemGst",
DROP COLUMN IF EXISTS "banquetPrefix",
DROP COLUMN IF EXISTS "banquetTerms";

ALTER TABLE "Hotel" DROP COLUMN IF EXISTS "banquetSeq";
