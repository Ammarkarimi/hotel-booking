-- ID copies are no longer kept: the desk only ticks which original ID it saw at check-in.
-- The records go now; the files are deleted from storage by the app, a few at a time (FileCleanup).
INSERT INTO "FileCleanup" ("filePath")
SELECT "filePath" FROM "GuestDocument"
ON CONFLICT DO NOTHING;

DROP TABLE "GuestDocument";
