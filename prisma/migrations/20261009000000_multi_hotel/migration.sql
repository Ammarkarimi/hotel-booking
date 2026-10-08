-- Multi-hotel: every record now belongs to a hotel, and the software provider
-- tracks each hotel's monthly subscription payments.
--
-- Existing data is moved into one hotel ("hotel_main") named after the current
-- hotel profile, so an upgraded install keeps working exactly as before.

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "city" TEXT,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingStart" TEXT NOT NULL,
    "notes" TEXT,
    "bookingSeq" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "clearsMonth" BOOLEAN NOT NULL DEFAULT true,
    "method" TEXT NOT NULL DEFAULT 'upi',
    "reference" TEXT,
    "notes" TEXT,
    "paidOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- The existing hotel, named after its current profile. Free until the provider sets a fee.
INSERT INTO "Hotel" ("id", "name", "slug", "city", "contactPhone", "contactEmail", "billingStart", "bookingSeq", "updatedAt")
SELECT
    'hotel_main',
    s."hotelName",
    COALESCE(NULLIF(trim(both '-' from regexp_replace(lower(s."hotelName"), '[^a-z0-9]+', '-', 'g')), ''), 'hotel'),
    s."city",
    s."phone",
    s."email",
    to_char(CURRENT_DATE, 'YYYY-MM'),
    GREATEST(1000, COALESCE((SELECT max("number") FROM "Booking"), 1000)),
    CURRENT_TIMESTAMP
FROM (SELECT * FROM "HotelSettings" ORDER BY ("id" = 'default') DESC LIMIT 1) s;

INSERT INTO "Hotel" ("id", "name", "slug", "billingStart", "bookingSeq", "updatedAt")
SELECT 'hotel_main', 'My Hotel', 'my-hotel', to_char(CURRENT_DATE, 'YYYY-MM'),
       GREATEST(1000, COALESCE((SELECT max("number") FROM "Booking"), 1000)), CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Hotel");

-- Attach every existing record to that hotel.
ALTER TABLE "ActivityLog" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "Bill" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "Booking" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "Charge" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "Guest" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "GuestDocument" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "HotelSettings" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "Payment" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "Room" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "SeasonalRate" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main';
ALTER TABLE "Staff" ADD COLUMN "hotelId" TEXT NOT NULL DEFAULT 'hotel_main',
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "ActivityLog" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "Bill" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "Charge" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "Guest" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "GuestDocument" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "HotelSettings" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "Room" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "SeasonalRate" ALTER COLUMN "hotelId" DROP DEFAULT;
ALTER TABLE "Staff" ALTER COLUMN "hotelId" DROP DEFAULT;

-- Settings rows get normal ids now; the existing "default" row keeps its id.
ALTER TABLE "HotelSettings" ALTER COLUMN "id" DROP DEFAULT;

-- Booking numbers now count up per hotel (Hotel.bookingSeq) instead of one global sequence.
ALTER TABLE "Booking" ALTER COLUMN "number" DROP DEFAULT;
DROP SEQUENCE "Booking_number_seq";

-- Room numbers, booking numbers and invoice numbers only need to be unique within a hotel.
DROP INDEX "ActivityLog_createdAt_idx";
DROP INDEX "Bill_invoiceNumber_key";
DROP INDEX "Booking_number_key";
DROP INDEX "Booking_status_idx";
DROP INDEX "Guest_phone_idx";
DROP INDEX "Room_roomNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_slug_key" ON "Hotel"("slug");
CREATE INDEX "SubscriptionPayment_hotelId_month_idx" ON "SubscriptionPayment"("hotelId", "month");
CREATE INDEX "ActivityLog_hotelId_createdAt_idx" ON "ActivityLog"("hotelId", "createdAt");
CREATE UNIQUE INDEX "Bill_hotelId_invoiceNumber_key" ON "Bill"("hotelId", "invoiceNumber");
CREATE INDEX "Booking_hotelId_status_idx" ON "Booking"("hotelId", "status");
CREATE UNIQUE INDEX "Booking_hotelId_number_key" ON "Booking"("hotelId", "number");
CREATE INDEX "Charge_hotelId_idx" ON "Charge"("hotelId");
CREATE INDEX "Guest_hotelId_phone_idx" ON "Guest"("hotelId", "phone");
CREATE INDEX "GuestDocument_hotelId_idx" ON "GuestDocument"("hotelId");
CREATE UNIQUE INDEX "HotelSettings_hotelId_key" ON "HotelSettings"("hotelId");
CREATE INDEX "Payment_hotelId_paidAt_idx" ON "Payment"("hotelId", "paidAt");
CREATE INDEX "SeasonalRate_hotelId_idx" ON "SeasonalRate"("hotelId");
CREATE INDEX "Staff_hotelId_idx" ON "Staff"("hotelId");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelSettings" ADD CONSTRAINT "HotelSettings_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonalRate" ADD CONSTRAINT "SeasonalRate_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestDocument" ADD CONSTRAINT "GuestDocument_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
