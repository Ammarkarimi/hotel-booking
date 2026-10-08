-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "extrasTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "roomTax" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fixedRate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "ratePerNight" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'walk_in';

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "blacklisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "idType" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "passportNo" TEXT,
ADD COLUMN     "vip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visaNo" TEXT,
ALTER COLUMN "lastName" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "reference" TEXT;

-- AlterTable
-- houseKeeperName may already exist on databases created with `prisma db push`
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "houseKeeperName" TEXT;
ALTER TABLE "Room" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "housekeeping" TEXT NOT NULL DEFAULT 'clean',
ADD COLUMN     "housekeepingNotes" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "HotelSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "hotelName" TEXT NOT NULL DEFAULT 'My Hotel',
    "tagline" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "taxMode" TEXT NOT NULL DEFAULT 'flat',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "gstSlabs" TEXT NOT NULL DEFAULT '[{"upTo":1000,"rate":0},{"upTo":7500,"rate":5},{"upTo":null,"rate":18}]',
    "extrasTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "weekendSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "checkInTime" TEXT NOT NULL DEFAULT '12:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "bookingTerms" TEXT,
    "websiteEnabled" BOOLEAN NOT NULL DEFAULT true,
    "websiteAbout" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "roomType" TEXT,
    "percent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonalRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "staffId" TEXT,
    "staffName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_invoiceNumber_key" ON "Bill"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_number_key" ON "Booking"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_publicToken_key" ON "Booking"("publicToken");

-- CreateIndex
CREATE INDEX "Booking_roomId_checkInDate_checkOutDate_idx" ON "Booking"("roomId", "checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Guest_phone_idx" ON "Guest"("phone");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data migration ----------------------------------------------------------

-- Existing bookings get a random public token and the room's current price.
UPDATE "Booking" SET "publicToken" = md5(random()::text || id) WHERE "publicToken" IS NULL;
ALTER TABLE "Booking" ALTER COLUMN "publicToken" SET NOT NULL;
UPDATE "Booking" b SET "ratePerNight" = r."pricePerNight" FROM "Room" r WHERE b."roomId" = r.id AND b."ratePerNight" = 0;

-- Booking numbers start at 1001 so they look like real reference numbers.
SELECT setval(pg_get_serial_sequence('"Booking"', 'number'), GREATEST(1000, (SELECT COALESCE(MAX("number"), 0) FROM "Booking")));
UPDATE "Booking" SET "number" = "number" + 1000 WHERE "number" <= 1000;
SELECT setval(pg_get_serial_sequence('"Booking"', 'number'), (SELECT GREATEST(1000, COALESCE(MAX("number"), 0)) FROM "Booking"));

-- Room availability is now date-based, and cleaning has its own status.
UPDATE "Room" SET "housekeeping" = 'cleaning', "status" = 'available' WHERE "status" = 'housekeeping';
UPDATE "Room" SET "status" = 'available' WHERE "status" = 'reserved';

-- Hotel settings row.
INSERT INTO "HotelSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;

-- Existing bills: all tax was on the room.
UPDATE "Bill" SET "roomTax" = "taxAmount" WHERE "roomTax" = 0;
