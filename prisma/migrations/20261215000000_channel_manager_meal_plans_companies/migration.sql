-- Channel manager (calendar links and Channex), meal plans, company accounts, the price list for extras and the review link.
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "channelCalendarId" TEXT,
ADD COLUMN     "channelRef" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "mealPlan" TEXT,
ADD COLUMN     "mealRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Hotel" ALTER COLUMN "modules" SET DEFAULT ARRAY['guest_forms', 'pathik', 'expenses', 'reports', 'shifts', 'rate_tips', 'website', 'channel_manager']::TEXT[];

-- AlterTable
ALTER TABLE "HotelSettings" ADD COLUMN     "mealPlans" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "reviewLink" TEXT;

-- CreateTable
CREATE TABLE "ChannelCalendar" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT,
    "roomId" TEXT,
    "roomType" TEXT,
    "exportToken" TEXT NOT NULL,
    "importUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastEvents" INTEGER NOT NULL DEFAULT 0,
    "exportSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelIssue" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "channelRef" TEXT,
    "bookingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,

    CONSTRAINT "ChannelIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannexLink" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomMap" TEXT NOT NULL DEFAULT '{}',
    "webhookId" TEXT,
    "markup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pushedHash" TEXT,
    "lastPushAt" TIMESTAMP(3),
    "lastPullAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannexLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "creditDays" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'food',
    "price" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCalendar_exportToken_key" ON "ChannelCalendar"("exportToken");

-- CreateIndex
CREATE INDEX "ChannelCalendar_hotelId_idx" ON "ChannelCalendar"("hotelId");

-- CreateIndex
CREATE INDEX "ChannelIssue_hotelId_status_idx" ON "ChannelIssue"("hotelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChannexLink_hotelId_key" ON "ChannexLink"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannexLink_propertyId_key" ON "ChannexLink"("propertyId");

-- CreateIndex
CREATE INDEX "Company_hotelId_idx" ON "Company"("hotelId");

-- CreateIndex
CREATE INDEX "MenuItem_hotelId_idx" ON "MenuItem"("hotelId");

-- CreateIndex
CREATE INDEX "Booking_hotelId_companyId_idx" ON "Booking"("hotelId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_hotelId_channelRef_key" ON "Booking"("hotelId", "channelRef");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCalendar" ADD CONSTRAINT "ChannelCalendar_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCalendar" ADD CONSTRAINT "ChannelCalendar_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelIssue" ADD CONSTRAINT "ChannelIssue_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannexLink" ADD CONSTRAINT "ChannexLink_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hotels and packages that have the online booking website get the channel manager too.
UPDATE "Hotel" SET "modules" = array_append("modules", 'channel_manager') WHERE 'website' = ANY("modules") AND NOT ('channel_manager' = ANY("modules"));
UPDATE "Package" SET "modules" = array_append("modules", 'channel_manager') WHERE 'website' = ANY("modules") AND NOT ('channel_manager' = ANY("modules"));
