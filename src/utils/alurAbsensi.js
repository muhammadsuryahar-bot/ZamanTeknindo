export const BATAS_ABSEN_MASUK_WIB = 12 * 60;
export const BATAS_KONFIRMASI_PULANG_WIB = 17 * 60;

export const PESAN_KONFIRMASI_PULANG_SAJA =
  "ANDA BELUM MELAKUKAN ABSEN MASUK, APAKAH ANDA AKAN MELAKUKAN ABSEN PULANG SAJA";

export const PESAN_ABSEN_PULANG_BELUM_WAKTU =
  "Absen masuk kamu sudah tercatat. Absen pulang baru dapat dilakukan mulai pukul 12.00 WIB. Tidak perlu mengirim absen masuk lagi.";

/**
 * Mencegah kamera untuk alur pulang dibuka sebelum batas 12:00 WIB.
 * Pemeriksaan yang sama berlaku untuk karyawan yang sudah masuk maupun
 * yang masuk ke mode pulang tanpa rekaman masuk.
 */
export function perluBlokirBukaKameraPulang(tahap, menitWIB) {
  return (
    (tahap === "sudah_masuk" || tahap === "langsung_pulang") &&
    Number.isFinite(minitWIBAman(menitWIB)) &&
    menitWIB < BATAS_ABSEN_MASUK_WIB
  );
}

/**
 * Menentukan endpoint berdasarkan status absensi server dan menit WIB saat
 * tombol dikirim. Tahap "sudah_masuk" wajib menuju /pulang, bukan /masuk.
 */
export function tentukanEndpointAbsensi(tahap, menitWIB) {
  if (!Number.isFinite(minitWIBAman(menitWIB))) return null;

  if (tahap === "sudah_masuk" || tahap === "langsung_pulang") {
    return menitWIB >= BATAS_ABSEN_MASUK_WIB ? "pulang" : null;
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
