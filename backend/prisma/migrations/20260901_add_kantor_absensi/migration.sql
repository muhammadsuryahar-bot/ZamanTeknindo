ALTER TABLE "absensi"
ADD COLUMN "kantor_masuk_id" INTEGER,
ADD COLUMN "kantor_pulang_id" INTEGER;

CREATE INDEX "absensi_kantor_masuk_id_idx" ON "absensi"("kantor_masuk_id");
CREATE INDEX "absensi_kantor_pulang_id_idx" ON "absensi"("kantor_pulang_id");

ALTER TABLE "absensi"
ADD CONSTRAINT "absensi_kantor_masuk_id_fkey"
FOREIGN KEY ("kantor_masuk_id") REFERENCES "kantor"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "absensi"
ADD CONSTRAINT "absensi_kantor_pulang_id_fkey"
FOREIGN KEY ("kantor_pulang_id") REFERENCES "kantor"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
