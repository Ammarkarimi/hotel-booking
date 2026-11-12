-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "HotelSettings" ADD COLUMN     "razorpayKeyId" TEXT,
ADD COLUMN     "razorpayKeySecret" TEXT,
ADD COLUMN     "tallyLedgers" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "upiId" TEXT,
ADD COLUMN     "upiName" TEXT;

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_linkId_key" ON "PaymentLink"("linkId");

-- CreateIndex
CREATE INDEX "PaymentLink_bookingId_idx" ON "PaymentLink"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_hotelId_groupId_idx" ON "Booking"("hotelId", "groupId");

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

