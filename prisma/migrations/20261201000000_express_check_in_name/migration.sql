-- "Guest forms" is now called "Express check-in". Only the starting description is changed;
-- a description the provider has written themselves is left alone.
UPDATE "Package" SET "description" = 'Basic, plus express check-in, expenses, reports and staff shifts.'
WHERE "id" = 'pkg_standard' AND "description" = 'Basic, plus guest forms on WhatsApp, expenses, reports and staff shifts.';
