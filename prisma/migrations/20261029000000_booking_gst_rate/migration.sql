-- GST % on the room chosen for one booking; empty means the default from Settings.
ALTER TABLE "Booking" ADD COLUMN "gstRate" DOUBLE PRECISION;
