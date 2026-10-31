-- How a shift ended, and its report exactly as saved; how many people can be on shift together.
ALTER TABLE "Shift" ADD COLUMN "endReason" TEXT;
ALTER TABLE "Shift" ADD COLUMN "reportText" TEXT;

-- Shifts ended before this change.
UPDATE "Shift" SET "endReason" = CASE WHEN "endedBy" IS NOT NULL THEN 'owner' ELSE 'staff' END WHERE "endedAt" IS NOT NULL;

ALTER TABLE "HotelSettings" ADD COLUMN "frontDeskStaff" INTEGER NOT NULL DEFAULT 1;

-- Taking over a shift when the front desk is full: the person on shift confirms.
ALTER TABLE "Shift" ADD COLUMN "handedOverTo" TEXT;

CREATE TABLE "ShiftTransfer" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "fromShiftId" TEXT NOT NULL,
    "fromStaffName" TEXT NOT NULL,
    "toStaffId" TEXT NOT NULL,
    "toStaffName" TEXT NOT NULL,
    "startNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,

    CONSTRAINT "ShiftTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftTransfer_hotelId_status_idx" ON "ShiftTransfer"("hotelId", "status");
CREATE INDEX "ShiftTransfer_fromShiftId_idx" ON "ShiftTransfer"("fromShiftId");

ALTER TABLE "ShiftTransfer" ADD CONSTRAINT "ShiftTransfer_fromShiftId_fkey" FOREIGN KEY ("fromShiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftTransfer" ADD CONSTRAINT "ShiftTransfer_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
