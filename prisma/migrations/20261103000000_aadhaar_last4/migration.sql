-- Only the last 4 digits of an Aadhaar number are kept ("XXXX XXXX 1234"), like UIDAI's masked Aadhaar.
-- Numbers saved earlier are cut down to their last 4 digits; anything with fewer than 4 digits is removed.
UPDATE "Guest"
SET "idNumber" = CASE
  WHEN length(regexp_replace("idNumber", '\D', '', 'g')) >= 4
    THEN 'XXXX XXXX ' || right(regexp_replace("idNumber", '\D', '', 'g'), 4)
  ELSE NULL
END
WHERE "idType" = 'aadhar' AND "idNumber" IS NOT NULL;
