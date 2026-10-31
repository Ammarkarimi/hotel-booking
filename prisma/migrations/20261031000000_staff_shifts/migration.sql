-- Staff shifts: start and end of work, handover note and shift summary.
ALTER TABLE "HotelSettings" ADD COLUMN "staffShifts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HotelSettings" ADD COLUMN "ownerWhatsapp" TEXT;

CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "staffId" TEXT,
    "staffName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startNote" TEXT,
    "endedAt" TIMESTAMP(3),
    "handoverNote" TEXT,
    "endCode" TEXT,
    "endedBy" TEXT,
    "summary" TEXT,
    "ownerSeenAt" TIMESTAMP(3),

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Shift_hotelId_startedAt_idx" ON "Shift"("hotelId", "startedAt");
CREATE INDEX "Shift_hotelId_staffId_endedAt_idx" ON "Shift"("hotelId", "staffId", "endedAt");

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
