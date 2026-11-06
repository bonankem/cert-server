-- Default certificate design chosen in admin Settings.
ALTER TABLE "certificate_settings"
ADD COLUMN "design_variant" TEXT NOT NULL DEFAULT 'classic';
