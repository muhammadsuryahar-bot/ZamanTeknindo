-- AlterTable
ALTER TABLE `absensi` MODIFY `status_otomatis` ENUM('tepat_waktu', 'telat', 'alpha', 'izin', 'sakit', 'cuti', 'urgent') NULL,
    MODIFY `status_final` ENUM('tepat_waktu', 'telat', 'alpha', 'izin', 'sakit', 'cuti', 'urgent') NULL;
