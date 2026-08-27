-- Mencegah satu karyawan memiliki lebih dari satu pengajuan aktif
-- (menunggu/disetujui) pada tanggal yang sama.
-- Pengajuan yang sudah ditolak tetap boleh dibuat ulang.

CREATE UNIQUE INDEX "pengajuan_izin_satu_aktif_per_karyawan_tanggal_idx"
ON "pengajuan_izin" ("pengguna_id", "tanggal")
WHERE "status" IN ('menunggu', 'disetujui');
