-- CreateTable
CREATE TABLE `kantor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_kantor` VARCHAR(191) NOT NULL,
    `alamat` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengguna` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `kata_sandi` VARCHAR(191) NOT NULL,
    `peran` ENUM('admin', 'karyawan') NOT NULL DEFAULT 'karyawan',
    `jabatan` VARCHAR(191) NULL,
    `divisi` VARCHAR(191) NULL,
    `kantor_id` INTEGER NULL,
    `status_akun` ENUM('menunggu_konfirmasi', 'aktif', 'nonaktif') NOT NULL DEFAULT 'menunggu_konfirmasi',
    `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pengguna_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `absensi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pengguna_id` INTEGER NOT NULL,
    `tanggal` DATE NOT NULL,
    `jam_masuk` DATETIME(3) NULL,
    `jam_pulang` DATETIME(3) NULL,
    `foto_masuk` VARCHAR(191) NULL,
    `foto_pulang` VARCHAR(191) NULL,
    `latitude_masuk` DOUBLE NULL,
    `longitude_masuk` DOUBLE NULL,
    `alamat_masuk` TEXT NULL,
    `latitude_pulang` DOUBLE NULL,
    `longitude_pulang` DOUBLE NULL,
    `alamat_pulang` TEXT NULL,
    `status_otomatis` ENUM('tepat_waktu', 'telat', 'alpha') NULL,
    `status_final` ENUM('tepat_waktu', 'telat', 'alpha') NULL,
    `catatan_admin` TEXT NULL,
    `diedit_oleh` INTEGER NULL,
    `waktu_edit` DATETIME(3) NULL,
    `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `absensi_pengguna_id_tanggal_key`(`pengguna_id`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pengguna` ADD CONSTRAINT `pengguna_kantor_id_fkey` FOREIGN KEY (`kantor_id`) REFERENCES `kantor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `absensi` ADD CONSTRAINT `absensi_pengguna_id_fkey` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `absensi` ADD CONSTRAINT `absensi_diedit_oleh_fkey` FOREIGN KEY (`diedit_oleh`) REFERENCES `pengguna`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
