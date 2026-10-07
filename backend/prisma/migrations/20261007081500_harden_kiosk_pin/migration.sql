-- Harden Kiosk PIN configuration without changing any existing PIN value.
-- Safe for both existing production databases and fresh environments where the
-- column may not yet exist because it historically lived outside tracked migrations.

ALTER TABLE "pengaturan_potongan"
ADD COLUMN IF NOT EXISTS "kiosk_pin" TEXT;

UPDATE "pengaturan_potongan"
SET "kiosk_pin" = ''
WHERE "kiosk_pin" IS NULL;

ALTER TABLE "pengaturan_potongan"
ALTER COLUMN "kiosk_pin" SET NOT NULL;

ALTER TABLE "pengaturan_potongan"
ALTER COLUMN "kiosk_pin" DROP DEFAULT;
