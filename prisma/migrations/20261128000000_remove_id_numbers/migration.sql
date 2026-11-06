-- No ID numbers are kept: no ID, passport or visa number. The desk records only which ID it saw
-- (Guest.idType and the ID check ticks); the hotel keeps any copies or numbers it needs itself.
ALTER TABLE "Guest" DROP COLUMN "idNumber",
DROP COLUMN "passportNo",
DROP COLUMN "visaNo";
