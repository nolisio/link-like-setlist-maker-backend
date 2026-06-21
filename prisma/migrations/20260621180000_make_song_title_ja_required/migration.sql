UPDATE "Song"
SET "titleJa" = "title"
WHERE "titleJa" IS NULL;

ALTER TABLE "Song"
ALTER COLUMN "titleJa" SET NOT NULL;
