-- Guest address details asked by the police guest register (Pathik)
ALTER TABLE "Guest" ADD COLUMN "locality" TEXT;
ALTER TABLE "Guest" ADD COLUMN "district" TEXT;

-- Vehicle type, and when the stay was entered in Pathik
ALTER TABLE "Booking" ADD COLUMN "vehicleType" TEXT;
ALTER TABLE "Booking" ADD COLUMN "pathikAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "pathikByName" TEXT;

-- Show "Fill in Pathik" (hotels outside Gujarat can switch it off in Settings)
ALTER TABLE "HotelSettings" ADD COLUMN "pathik" BOOLEAN NOT NULL DEFAULT true;
