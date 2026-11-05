-- Banquets: halls, menus, functions and their extra items. Payments now belong to a room booking or a banquet.
-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "banquetSeq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "HotelSettings" ADD COLUMN     "banquetFoodGst" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN     "banquetHallGst" DOUBLE PRECISION NOT NULL DEFAULT 18,
ADD COLUMN     "banquetItemGst" DOUBLE PRECISION NOT NULL DEFAULT 18,
ADD COLUMN     "banquetPrefix" TEXT NOT NULL DEFAULT 'BQ',
ADD COLUMN     "banquetTerms" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "banquetId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BanquetHall" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "rent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanquetHall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetMenu" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "foodType" TEXT NOT NULL DEFAULT 'veg',
    "pricePerPlate" DOUBLE PRECISION NOT NULL,
    "items" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanquetMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banquet" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enquiry',
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "gstin" TEXT,
    "address" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'wedding',
    "eventName" TEXT,
    "hallId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "session" TEXT NOT NULL DEFAULT 'dinner',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "expectedPax" INTEGER NOT NULL,
    "guaranteedPax" INTEGER NOT NULL DEFAULT 0,
    "actualPax" INTEGER,
    "seating" TEXT,
    "menuName" TEXT,
    "foodType" TEXT NOT NULL DEFAULT 'veg',
    "menuItems" TEXT,
    "platePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "foodGst" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "hallRent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hallGst" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requirements" TEXT,
    "notes" TEXT,
    "followUpOn" DATE,
    "invoiceNumber" TEXT,
    "billedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banquet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetItem" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "banquetId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanquetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BanquetHall_hotelId_name_key" ON "BanquetHall"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BanquetMenu_hotelId_name_key" ON "BanquetMenu"("hotelId", "name");

-- CreateIndex
CREATE INDEX "Banquet_hotelId_eventDate_idx" ON "Banquet"("hotelId", "eventDate");

-- CreateIndex
CREATE INDEX "Banquet_hallId_eventDate_idx" ON "Banquet"("hallId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "Banquet_hotelId_number_key" ON "Banquet"("hotelId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Banquet_hotelId_invoiceNumber_key" ON "Banquet"("hotelId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "BanquetItem_hotelId_idx" ON "BanquetItem"("hotelId");

-- CreateIndex
CREATE INDEX "Payment_banquetId_idx" ON "Payment"("banquetId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_banquetId_fkey" FOREIGN KEY ("banquetId") REFERENCES "Banquet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetHall" ADD CONSTRAINT "BanquetHall_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetMenu" ADD CONSTRAINT "BanquetMenu_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banquet" ADD CONSTRAINT "Banquet_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "BanquetHall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banquet" ADD CONSTRAINT "Banquet_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetItem" ADD CONSTRAINT "BanquetItem_banquetId_fkey" FOREIGN KEY ("banquetId") REFERENCES "Banquet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetItem" ADD CONSTRAINT "BanquetItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every payment belongs to exactly one room booking or one banquet.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_one_owner" CHECK (("bookingId" IS NULL) <> ("banquetId" IS NULL));
