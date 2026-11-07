-- Room prices can be entered with GST included. Each booking keeps the setting it was made under,
-- so changing the setting never changes an existing bill.
ALTER TABLE "HotelSettings" ADD COLUMN "roomPricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;
