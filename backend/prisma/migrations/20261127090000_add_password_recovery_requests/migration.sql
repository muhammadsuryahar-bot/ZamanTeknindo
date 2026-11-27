CREATE TABLE IF NOT EXISTS "permintaan_reset_password" (
  "id" SERIAL NOT NULL,
  "pengguna_id" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'menunggu_verifikasi',
  "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tautan_dibuat_pada" TIMESTAMP(3),
  "token_jti" TEXT,
  "ditangani_oleh" INTEGER,
  "selesai_pada" TIMESTAMP(3),
  "diubah_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permintaan_reset_password_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permintaan_reset_password_pengguna_id_fkey') THEN
    ALTER TABLE "permintaan_reset_password"
      ADD CONSTRAINT "permintaan_reset_password_pengguna_id_fkey"
      FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permintaan_reset_password_ditangani_oleh_fkey') THEN
    ALTER TABLE "permintaan_reset_password"
      ADD CONSTRAINT "permintaan_reset_password_ditangani_oleh_fkey"
      FOREIGN KEY ("ditangani_oleh") REFERENCES "pengguna"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "permintaan_reset_password_status_idx"
  ON "permintaan_reset_password"("status");
CREATE INDEX IF NOT EXISTS "permintaan_reset_password_pengguna_id_idx"
  ON "permintaan_reset_password"("pengguna_id");
CREATE INDEX IF NOT EXISTS "permintaan_reset_password_dibuat_pada_idx"
  ON "permintaan_reset_password"("dibuat_pada");
CREATE UNIQUE INDEX IF NOT EXISTS "permintaan_reset_password_satu_aktif_per_pengguna_idx"
  ON "permintaan_reset_password"("pengguna_id")
  WHERE "status" IN ('menunggu_verifikasi', 'tautan_dibuat');

ALTER TABLE "permintaan_reset_password" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "permintaan_reset_password" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE "permintaan_reset_password_id_seq" FROM anon, authenticated;
