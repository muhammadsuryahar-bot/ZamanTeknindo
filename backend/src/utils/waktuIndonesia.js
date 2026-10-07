// utils/waktuIndonesia.js - FIX FINAL 08:10 & 17:00 + tanggalHariIniWIB (fondasi tetap)
const JAM_MASUK_STANDAR_DEFAULT = process.env.JAM_MASUK_STANDAR || "08:10";
const JAM_PULANG_STANDAR_DEFAULT = process.env.JAM_PULANG_STANDAR || "17:00";
const BATAS_ABSEN_MASUK_WIB = 12 * 60;

function getWIBDateParts(date = new Date()) {
  const wibDateStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const wibTimeStr = date.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });
  const [tahun, bulan, tanggal] = wibDateStr.split("-").map(Number);
  const [jam, menit, detik] = wibTimeStr.split(":").map(Number);
  return { wibDateStr, wibTimeStr, tahun, bulan, tanggal, jam, menit, detik };
}

// Bentuk data waktu yang kompatibel dengan modul laporan/export lama:
// hari/bulan/tahun + jam/menit/detik dalam zona WIB.
function bagianWaktuWIB(date = new Date()) {
  const bagian = getWIBDateParts(date);
  return {
    tahun: bagian.tahun,
    bulan: bagian.bulan,
    hari: bagian.tanggal,
    jam: bagian.jam,
    menit: bagian.menit,
    detik: bagian.detik,
  };
}

function tahunBulanSekarangWIB() {
  const { tahun, bulan, tanggal, jam, menit } = getWIBDateParts();
  return { tahun, bulan, tanggal, jam, menit };
}

function parseJam(jamStr) {
  const raw = String(jamStr || JAM_MASUK_STANDAR_DEFAULT).trim();
  const [h, m] = raw.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 8 * 60 + 10;
  return h * 60 + m;
}

function jamMasukWIBToMenit(date) {
  if (!date) return null;
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const { jam, menit } = getWIBDateParts(d);
    if (!Number.isFinite(jam) || !Number.isFinite(menit)) return null;
    return jam * 60 + menit;
  } catch {
    return null;
  }
}

// FIX penting yang dicari rekapAbsensiFixedController.js
function tanggalHariIniWIB() {
  const wibDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  return new Date(`${wibDateStr}T23:59:59.999+07:00`);
}

function tanggalHariIniWIBString() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function getWIBTodayRange() {
  const wibDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const start = new Date(`${wibDateStr}T00:00:00+07:00`);
  const end = new Date(`${wibDateStr}T23:59:59.999+07:00`);
  const tanggalDate = new Date(`${wibDateStr}T00:00:00.000Z`);
  return { wibDateStr, start, end, tanggalDate };
}

function getWIBNow() {
  const wibStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  return new Date(wibStr);
}

function totalMenitWIB(date = new Date()) {
  const { jam, menit } = getWIBDateParts(date);
  return jam * 60 + menit;
}

function sudahLewatBatasAbsenMasukWIB(date = new Date()) {
  return totalMenitWIB(date) >= BATAS_ABSEN_MASUK_WIB;
}

function getWIBTimeInfo() {
  const { jam, menit } = getWIBDateParts();
  const totalMenit = jam * 60 + menit;
  const jamStr = `${String(jam).padStart(2, "0")}:${String(menit).padStart(2, "0")}`;
  return { jam, menit, totalMenit, jamStr, wibNow: getWIBNow() };
}

function statusEfektif(absen, jamMasukStandar) {
  if (!absen) return "alpha";

  // Status yang sudah ditetapkan Admin adalah sumber kebenaran utama.
  // Sebelumnya utility membaca field `status` yang tidak ada pada model
  // Absensi sehingga edit status Admin bisa diabaikan oleh dashboard/gaji.
  const statusFinal = String(absen.statusFinal || "").trim();
  if (Object.values({
    TEPAT_WAKTU: "tepat_waktu",
    TELAT: "telat",
    ALPHA: "alpha",
    IZIN: "izin",
    SAKIT: "sakit",
    CUTI: "cuti",
    URGENT: "urgent",
  }).includes(statusFinal)) {
    return statusFinal;
  }

  const statusOtomatis = String(absen.statusOtomatis || "").trim();
  if (Object.values({
    TEPAT_WAKTU: "tepat_waktu",
    TELAT: "telat",
    ALPHA: "alpha",
    IZIN: "izin",
    SAKIT: "sakit",
    CUTI: "cuti",
    URGENT: "urgent",
  }).includes(statusOtomatis)) {
    return statusOtomatis;
  }

  if (!absen.jamMasuk) return "alpha";
  const standar = jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;
  const batasMenit = parseJam(standar);
  const masukMenit = jamMasukWIBToMenit(absen.jamMasuk);
  if (masukMenit === null) return "alpha";
  if (masukMenit > batasMenit) return "telat";
  return "tepat_waktu";
}

module.exports = {
  tahunBulanSekarangWIB,
  statusEfektif,
  JAM_MASUK_STANDAR_DEFAULT,
  JAM_PULANG_STANDAR_DEFAULT,
  parseJam,
  jamMasukWIBToMenit,
  tanggalHariIniWIB,
  tanggalHariIniWIBString,
  getWIBTodayRange,
  getWIBNow,
  getWIBTimeInfo,
  getWIBDateParts,
  bagianWaktuWIB,
  BATAS_ABSEN_MASUK_WIB,
  totalMenitWIB,
  sudahLewatBatasAbsenMasukWIB,
};