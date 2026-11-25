export const MAKS_AKURASI_LOKASI_METER = 100;

export function akurasiLokasiLayak(nilai) {
  const akurasi = Number(nilai);
  return Number.isFinite(akurasi) && akurasi > 0 && akurasi <= MAKS_AKURASI_LOKASI_METER;
}

export function pesanKesalahanGeolokasi(kode) {
  switch (Number(kode)) {
    case 1:
      return "Izin lokasi ditolak oleh browser. Di Chrome, klik ikon di sebelah alamat situs > Setelan situs > Lokasi > Izinkan. Pastikan Layanan lokasi Windows juga aktif.";

    case 2:
      return "Windows/browser tidak dapat menentukan lokasi perangkat. Aktifkan Windows Settings > Privacy & security > Location, izinkan Chrome mengakses lokasi, dan sambungkan Wi-Fi. Laptop tanpa GPS dapat menghasilkan lokasi yang kurang akurat.";

    case 3:
      return "Pencarian lokasi melewati batas 20 detik. Pastikan Layanan lokasi Windows dan izin lokasi situs aktif, Wi-Fi tersambung, lalu tekan Foto Ulang. Jika tetap tidak mencapai akurasi ±100 meter, gunakan HP.";

    default:
      return "Lokasi perangkat belum dapat dibaca. Periksa izin lokasi browser dan layanan lokasi perangkat, lalu tekan Foto Ulang.";
  }
}
