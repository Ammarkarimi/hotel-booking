-- AlterTable
ALTER TABLE "HotelSettings" ADD COLUMN     "rateTips" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rateTipsFloors" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "rateTipsFrom" TEXT NOT NULL DEFAULT '13:00',
ADD COLUMN     "rateTipsMaxDiscount" DOUBLE PRECISION NOT NULL DEFAULT 20,
ADD COLUMN     "rateTipsStaff" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "RateTipSeen" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "tipKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateTipSeen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateTipSeen_hotelId_createdAt_idx" ON "RateTipSeen"("hotelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateTipSeen_hotelId_staffId_tipKey_key" ON "RateTipSeen"("hotelId", "staffId", "tipKey");

-- AddForeignKey
ALTER TABLE "RateTipSeen" ADD CONSTRAINT "RateTipSeen_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

