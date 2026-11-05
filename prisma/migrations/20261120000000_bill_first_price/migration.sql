-- The price first agreed with the guest, saved the first time the bill is edited (for the Bookings report)
ALTER TABLE "Booking" ADD COLUMN "originalPrice" TEXT;
