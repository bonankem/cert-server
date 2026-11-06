ALTER TABLE "certificate_settings"
ADD COLUMN "start_date" TEXT NOT NULL DEFAULT '',
ADD COLUMN "end_date" TEXT NOT NULL DEFAULT '';
