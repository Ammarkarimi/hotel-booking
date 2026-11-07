-- Room prices on Today: with or without GST (the owner chooses in Settings).
ALTER TABLE "HotelSettings" ADD COLUMN "pricesWithTax" BOOLEAN NOT NULL DEFAULT false;
