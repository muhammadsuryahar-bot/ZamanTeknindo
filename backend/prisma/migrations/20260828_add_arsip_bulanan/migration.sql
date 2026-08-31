CREATE TYPE "StatusArsip" AS ENUM ('draft', 'siap_dihapus', 'diproses', 'selesai', 'gagal', 'dibatalkan');

CREATE TABLE "arsip_bulanan" (
    "id" SERIAL NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "nama_file" TEXT,
    "lokasi_arsip" TEXT,
    "status" "StatusArsip" NOT NULL DEFAULT 'draft',
    "dikonfirmasi_pada" TIMESTAMP(3),
    "siap_dihapus_pada" TIMESTAMP(3),
    "mulai_dihapus_pada" TIMESTAMP(3),
    "selesai_dihapus_pada" TIMESTAMP(3),
    "jumlah_absensi_awal" INTEGER NOT NULL DEFAULT 0,
    "jumlah_foto_awal" INTEGER NOT NULL DEFAULT 0,
    "jumlah_absensi_dihapus" INTEGER NOT NULL DEFAULT 0,
    "jumlah_foto_dihapus" INTEGER NOT NULL DEFAULT 0,
    "pesan_error" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arsip_bulanan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arsip_bulanan_tahun_bulan_key" ON "arsip_bulanan"("tahun", "bulan");
CREATE INDEX "arsip_bulanan_status_siap_dihapus_pada_idx" ON "arsip_bulanan"("status", "siap_dihapus_pada");
