export const BATAS_ABSEN_MASUK_WIB = 12 * 60;
export const BATAS_KONFIRMASI_PULANG_WIB = 17 * 60;

export const PESAN_KONFIRMASI_PULANG_SAJA =
  "ANDA BELUM MELAKUKAN ABSEN MASUK, APAKAH ANDA AKAN MELAKUKAN ABSEN PULANG SAJA";

/**
 * Menentukan endpoint berdasarkan status absensi server dan menit WIB saat
 * tombol dikirim. Tahap "sudah_masuk" wajib menuju /pulang, bukan /masuk.
 */
export function tentukanEndpointAbsensi(tahap, menitWIB) {
  if (!Number.isFinite(minitWIBAman(menitWIB))) return null;

  if (tahap === "sudah_masuk" || tahap === "langsung_pulang") {
    return "pulang";
  }

  if (tahap === "belum_masuk") {
    return menitWIB >= BATAS_ABSEN_MASUK_WIB ? "pulang" : "masuk";
  }

  return null;
}

/** Minta konfirmasi hanya jika belum ada absen masuk pada pukul 12–17 WIB. */
export function perluKonfirmasiPulangSaja(tahap, menitWIB) {
  return (
    tahap === "langsung_pulang" &&
    Number.isFinite(minitWIBAman(menitWIB)) &&
    menitWIB >= BATAS_ABSEN_MASUK_WIB &&
    menitWIB < BATAS_KONFIRMASI_PULANG_WIB
  );
}

function minitWIBAman(nilai) {
  return typeof nilai === "number" ? nilai : Number.NaN;
}
