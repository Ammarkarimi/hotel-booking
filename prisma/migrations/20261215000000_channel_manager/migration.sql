-- Channel manager: calendar links with booking sites, the link to Channex, and things a person must look at.
-- Also the hotel's Google review link for the check-out message.
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "channelCalendarId" TEXT,
ADD COLUMN     "channelRef" TEXT;

-- AlterTable
ALTER TABLE "Hotel" ALTER COLUMN "modules" SET DEFAULT ARRAY['guest_forms', 'pathik', 'expenses', 'reports', 'shifts', 'rate_tips', 'website', 'channel_manager']::TEXT[];

-- AlterTable
ALTER TABLE "HotelSettings" ADD COLUMN     "reviewLink" TEXT;

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
CREATE UNIQUE INDEX "Booking_hotelId_channelRef_key" ON "Booking"("hotelId", "channelRef");

-- AddForeignKey
ALTER TABLE "ChannelCalendar" ADD CONSTRAINT "ChannelCalendar_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCalendar" ADD CONSTRAINT "ChannelCalendar_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelIssue" ADD CONSTRAINT "ChannelIssue_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannexLink" ADD CONSTRAINT "ChannexLink_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hotels and packages that have the online booking website get the channel manager too.
UPDATE "Hotel" SET "modules" = array_append("modules", 'channel_manager') WHERE 'website' = ANY("modules") AND NOT ('channel_manager' = ANY("modules"));
UPDATE "Package" SET "modules" = array_append("modules", 'channel_manager') WHERE 'website' = ANY("modules") AND NOT ('channel_manager' = ANY("modules"));
