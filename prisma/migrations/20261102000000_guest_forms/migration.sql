-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "comingFrom" TEXT,
ADD COLUMN     "companions" TEXT,
ADD COLUMN     "goingTo" TEXT,
ADD COLUMN     "vehicleNumber" TEXT;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "city" TEXT,
ADD COLUMN     "pinCode" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "GuestDocument" ADD COLUMN     "guestFormId" TEXT,
ADD COLUMN     "person" TEXT,
ALTER COLUMN "guestId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GuestForm" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "guestName" TEXT,
    "checkInDate" TIMESTAMP(3),
    "checkOutDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'sent',
    "details" TEXT,
    "sentById" TEXT,
    "sentByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,

    CONSTRAINT "GuestForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestForm_token_key" ON "GuestForm"("token");

-- CreateIndex
CREATE INDEX "GuestForm_hotelId_status_idx" ON "GuestForm"("hotelId", "status");

-- CreateIndex
CREATE INDEX "GuestDocument_guestFormId_idx" ON "GuestDocument"("guestFormId");

-- AddForeignKey
ALTER TABLE "GuestDocument" ADD CONSTRAINT "GuestDocument_guestFormId_fkey" FOREIGN KEY ("guestFormId") REFERENCES "GuestForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestForm" ADD CONSTRAINT "GuestForm_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

