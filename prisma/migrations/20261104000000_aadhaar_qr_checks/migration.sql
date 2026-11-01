-- CreateTable
CREATE TABLE "IdCheck" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "person" TEXT,
    "method" TEXT NOT NULL,
    "idType" TEXT,
    "checkedById" TEXT,
    "checkedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileCleanup" (
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileCleanup_pkey" PRIMARY KEY ("filePath")
);

-- CreateIndex
CREATE INDEX "IdCheck_bookingId_idx" ON "IdCheck"("bookingId");

-- AddForeignKey
ALTER TABLE "IdCheck" ADD CONSTRAINT "IdCheck_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdCheck" ADD CONSTRAINT "IdCheck_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nothing from an Aadhaar is kept any more: it is checked by scanning its QR code at check-in.
-- 1. The last 4 digits saved on guest profiles.
UPDATE "Guest" SET "idNumber" = NULL WHERE "idType" = 'aadhar';

-- 2. Copies of Aadhaar cards: the records go now, the files are deleted from storage by the app.
INSERT INTO "FileCleanup" ("filePath")
SELECT "filePath" FROM "GuestDocument" WHERE "type" = 'aadhar'
ON CONFLICT DO NOTHING;
DELETE FROM "GuestDocument" WHERE "type" = 'aadhar';

-- 3. The last 4 digits inside guest forms already sent.
UPDATE "GuestForm"
SET "details" = (
  ("details"::jsonb - 'aadhaarLast4')
  || jsonb_build_object('companions', COALESCE(
       (SELECT jsonb_agg(c - 'aadhaarLast4') FROM jsonb_array_elements(("details"::jsonb) -> 'companions') AS c),
       '[]'::jsonb))
)::text
WHERE "details" LIKE '%aadhaarLast4%';

-- 4. The masked number kept for other adults in a booking.
UPDATE "Booking"
SET "companions" = (SELECT jsonb_agg(c - 'aadhaar') FROM jsonb_array_elements("companions"::jsonb) AS c)::text
WHERE "companions" LIKE '%"aadhaar"%';
