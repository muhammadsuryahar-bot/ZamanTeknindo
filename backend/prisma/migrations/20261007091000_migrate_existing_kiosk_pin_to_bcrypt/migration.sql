-- Preserve the existing Kiosk PIN value while replacing plaintext storage with bcrypt.
-- Safe to run more than once because already-hashed values are skipped.
UPDATE "pengaturan_potongan"
SET "kiosk_pin" = extensions.crypt("kiosk_pin", extensions.gen_salt('bf', 12))
WHERE "id" = 1
  AND "kiosk_pin" <> ''
  AND "kiosk_pin" !~ '^\\$2[aby]\\$';
