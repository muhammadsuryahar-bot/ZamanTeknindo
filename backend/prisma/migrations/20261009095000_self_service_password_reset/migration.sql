-- Token reset password disimpan sebagai hash, berlaku singkat, dan sekali pakai.
-- IF NOT EXISTS menjaga migrasi tetap aman bila kolom pernah ditambahkan manual.
ALTER TABLE "public"."pengguna"
  ADD COLUMN IF NOT EXISTS "password_reset_token_hash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "password_reset_token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "password_reset_requested_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "pengguna_password_reset_token_hash_idx"
  ON "public"."pengguna" ("password_reset_token_hash");
