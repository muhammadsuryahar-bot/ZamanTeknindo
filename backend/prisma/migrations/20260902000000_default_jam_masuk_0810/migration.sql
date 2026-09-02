-- Samakan default database dengan aturan absensi terbaru:
-- 08:10 adalah batas tepat waktu dan perhitungan dilakukan per menit.
ALTER TABLE "pengaturan_potongan"
ALTER COLUMN "jam_masuk_standar" SET DEFAULT '08:10:00';
