-- CreateTable
CREATE TABLE `gaji_karyawan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pengguna_id` INTEGER NOT NULL,
    `gaji_pokok` DECIMAL(12, 2) NOT NULL,
    `diubah_pada` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gaji_karyawan_pengguna_id_key`(`pengguna_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengaturan_potongan` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `potongan_telat` DECIMAL(12, 2) NOT NULL DEFAULT 10000,
    `potongan_alpha` DECIMAL(12, 2) NOT NULL DEFAULT 15000,
    `jam_masuk_standar` VARCHAR(191) NOT NULL DEFAULT '08:00:00',
    `diubah_pada` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengajuan_izin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pengguna_id` INTEGER NOT NULL,
    `tanggal` DATE NOT NULL,
    `jenis` ENUM('izin', 'sakit', 'cuti', 'urgent') NOT NULL,
    `keterangan` TEXT NOT NULL,
    `foto_surat` VARCHAR(191) NULL,
    `status` ENUM('menunggu', 'disetujui', 'ditolak') NOT NULL DEFAULT 'menunggu',
    `diproses_oleh` INTEGER NULL,
    `waktu_proses` DATETIME(3) NULL,
    `catatan_admin` TEXT NULL,
    `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `laporan_gaji` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pengguna_id` INTEGER NOT NULL,
    `tahun` INTEGER NOT NULL,
    `bulan` INTEGER NOT NULL,
    `jumlah_tepat_waktu` INTEGER NOT NULL DEFAULT 0,
    `jumlah_telat` INTEGER NOT NULL DEFAULT 0,
    `jumlah_alpha` INTEGER NOT NULL DEFAULT 0,
    `jumlah_izin` INTEGER NOT NULL DEFAULT 0,
    `jumlah_sakit` INTEGER NOT NULL DEFAULT 0,
    `jumlah_cuti` INTEGER NOT NULL DEFAULT 0,
    `gaji_pokok` DECIMAL(12, 2) NOT NULL,
    `total_potongan` DECIMAL(12, 2) NOT NULL,
    `gaji_diterima` DECIMAL(12, 2) NOT NULL,
    `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `laporan_gaji_pengguna_id_tahun_bulan_key`(`pengguna_id`, `tahun`, `bulan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `gaji_karyawan` ADD CONSTRAINT `gaji_karyawan_pengguna_id_fkey` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengajuan_izin` ADD CONSTRAINT `pengajuan_izin_pengguna_id_fkey` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengajuan_izin` ADD CONSTRAINT `pengajuan_izin_diproses_oleh_fkey` FOREIGN KEY (`diproses_oleh`) REFERENCES `pengguna`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `laporan_gaji` ADD CONSTRAINT `laporan_gaji_pengguna_id_fkey` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
