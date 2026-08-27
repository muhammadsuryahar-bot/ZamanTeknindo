-- CreateEnum
CREATE TYPE "Peran" AS ENUM ('admin', 'karyawan');

-- CreateEnum
CREATE TYPE "StatusAkun" AS ENUM ('menunggu_konfirmasi', 'aktif', 'nonaktif');

-- CreateEnum
CREATE TYPE "StatusKehadiran" AS ENUM ('tepat_waktu', 'telat', 'alpha', 'izin', 'sakit', 'cuti', 'urgent');

-- CreateEnum
CREATE TYPE "JenisIzin" AS ENUM ('izin', 'sakit', 'cuti', 'urgent');

-- CreateEnum
CREATE TYPE "StatusPengajuan" AS ENUM ('menunggu', 'disetujui', 'ditolak');

-- CreateTable
CREATE TABLE "kantor" (
    "id" SERIAL NOT NULL,
    "nama_kantor" TEXT NOT NULL,
    "alamat" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kantor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengguna" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kata_sandi" TEXT NOT NULL,
    "peran" "Peran" NOT NULL DEFAULT 'karyawan',
    "jabatan" TEXT,
    "divisi" TEXT,
    "kantor_id" INTEGER,
    "status_akun" "StatusAkun" NOT NULL DEFAULT 'menunggu_konfirmasi',
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absensi" (
    "id" SERIAL NOT NULL,
    "pengguna_id" INTEGER NOT NULL,
    "tanggal" DATE NOT NULL,
    "jam_masuk" TIMESTAMP(3),
    "jam_pulang" TIMESTAMP(3),
    "foto_masuk" TEXT,
    "foto_pulang" TEXT,
    "latitude_masuk" DOUBLE PRECISION,
    "longitude_masuk" DOUBLE PRECISION,
    "alamat_masuk" TEXT,
    "latitude_pulang" DOUBLE PRECISION,
    "longitude_pulang" DOUBLE PRECISION,
    "alamat_pulang" TEXT,
    "status_otomatis" "StatusKehadiran",
    "status_final" "StatusKehadiran",
    "catatan_admin" TEXT,
    "diedit_oleh" INTEGER,
    "waktu_edit" TIMESTAMP(3),
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gaji_karyawan" (
    "id" SERIAL NOT NULL,
    "pengguna_id" INTEGER NOT NULL,
    "gaji_pokok" DECIMAL(12,2) NOT NULL,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gaji_karyawan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengaturan_potongan" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "potongan_telat" DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
    "potongan_alpha" DECIMAL(12,2) NOT NULL DEFAULT 15000.00,
    "jam_masuk_standar" TEXT NOT NULL DEFAULT '08:00:00',
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengaturan_potongan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hari_libur" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL,
    "keterangan" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hari_libur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengajuan_izin" (
    "id" SERIAL NOT NULL,
    "pengguna_id" INTEGER NOT NULL,
    "tanggal" DATE NOT NULL,
    "jenis" "JenisIzin" NOT NULL,
    "keterangan" TEXT NOT NULL,
    "foto_surat" TEXT,
    "status" "StatusPengajuan" NOT NULL DEFAULT 'menunggu',
    "diproses_oleh" INTEGER,
    "waktu_proses" TIMESTAMP(3),
    "catatan_admin" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengajuan_izin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laporan_gaji" (
    "id" SERIAL NOT NULL,
    "pengguna_id" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "jumlah_tepat_waktu" INTEGER NOT NULL DEFAULT 0,
    "jumlah_telat" INTEGER NOT NULL DEFAULT 0,
    "jumlah_alpha" INTEGER NOT NULL DEFAULT 0,
    "jumlah_izin" INTEGER NOT NULL DEFAULT 0,
    "jumlah_sakit" INTEGER NOT NULL DEFAULT 0,
    "jumlah_cuti" INTEGER NOT NULL DEFAULT 0,
    "gaji_pokok" DECIMAL(12,2) NOT NULL,
    "total_potongan" DECIMAL(12,2) NOT NULL,
    "gaji_diterima" DECIMAL(12,2) NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laporan_gaji_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_email_key" ON "pengguna"("email");

-- CreateIndex
CREATE INDEX "pengguna_kantor_id_idx" ON "pengguna"("kantor_id");

-- CreateIndex
CREATE INDEX "absensi_diedit_oleh_idx" ON "absensi"("diedit_oleh");

-- CreateIndex
CREATE UNIQUE INDEX "absensi_pengguna_id_tanggal_key" ON "absensi"("pengguna_id", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "gaji_karyawan_pengguna_id_key" ON "gaji_karyawan"("pengguna_id");

-- CreateIndex
CREATE UNIQUE INDEX "hari_libur_tanggal_key" ON "hari_libur"("tanggal");

-- CreateIndex
CREATE INDEX "pengajuan_izin_diproses_oleh_idx" ON "pengajuan_izin"("diproses_oleh");

-- CreateIndex
CREATE INDEX "pengajuan_izin_pengguna_id_idx" ON "pengajuan_izin"("pengguna_id");

-- CreateIndex
CREATE UNIQUE INDEX "laporan_gaji_pengguna_id_tahun_bulan_key" ON "laporan_gaji"("pengguna_id", "tahun", "bulan");

-- AddForeignKey
ALTER TABLE "pengguna" ADD CONSTRAINT "pengguna_kantor_id_fkey" FOREIGN KEY ("kantor_id") REFERENCES "kantor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_diedit_oleh_fkey" FOREIGN KEY ("diedit_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gaji_karyawan" ADD CONSTRAINT "gaji_karyawan_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan_izin" ADD CONSTRAINT "pengajuan_izin_diproses_oleh_fkey" FOREIGN KEY ("diproses_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan_izin" ADD CONSTRAINT "pengajuan_izin_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_gaji" ADD CONSTRAINT "laporan_gaji_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

