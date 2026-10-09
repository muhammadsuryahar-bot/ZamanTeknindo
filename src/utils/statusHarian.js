// Helper kecil agar perilaku pergantian tanggal dapat diuji tanpa browser.
export function perluSinkronStatusHarian(tanggalAktif, tanggalSekarang, sedangMengirim = false) {
  return Boolean(
    tanggalAktif &&
    tanggalSekarang &&
    tanggalAktif !== tanggalSekarang &&
    !sedangMengirim
  );
}
