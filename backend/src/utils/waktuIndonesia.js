const TIMEZONE = "Asia/Jakarta";

function bagianWaktuWIB(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const result = {};
  for (const part of parts) {
    if (part.type !== "literal") result[part.type] = part.value;
  }

  return {
    tahun: Number(result.year),
    bulan: Number(result.month),
    hari: Number(result.day),
    jam: Number(result.hour),
    menit: Number(result.minute),
    detik: Number(result.second),
  };
}

function tanggalHariIniWIB(date = new Date()) {
  const wib = bagianWaktuWIB(date);
  return new Date(Date.UTC(wib.tahun, wib.bulan - 1, wib.hari));
}

function jamSekarangWIB(date = new Date()) {
  const wib = bagianWaktuWIB(date);
  return wib.jam + wib.menit / 60 + wib.detik / 3600;
}

function tahunBulanSekarangWIB(date = new Date()) {
  const wib = bagianWaktuWIB(date);
  return { tahun: wib.tahun, bulan: wib.bulan };
}

function sekarangWIB(date = new Date()) {
  return bagianWaktuWIB(date);
}

const JAM_MASUK_STANDAR_DEFAULT = "08:10:00";

function jamKeMenit(jam) {
  const bagian = String(jam || "").split(":").map(Number);
  if (bagian.length < 2 || bagian.some((n) => Number.isNaN(n))) return null;

  const [hour, minute] = bagian;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

function menitWIB(date = new Date()) {
  return Math.floor(jamSekarangWIB(date) * 60);
}

function statusOtomatisDariWaktu(
  waktu,
  jamMasukStandar = JAM_MASUK_STANDAR_DEFAULT,
) {
  if (!waktu) return null;

  const date = waktu instanceof Date ? waktu : new Date(waktu);
  if (Number.isNaN(date.getTime())) return null;

  const batas =
    jamKeMenit(jamMasukStandar) ?? jamKeMenit(JAM_MASUK_STANDAR_DEFAULT);

  return menitWIB(date) <= batas ? "tepat_waktu" : "telat";
}

function statusEfektif(
  absensi,
  jamMasukStandar = JAM_MASUK_STANDAR_DEFAULT,
) {
  if (!absensi) return "alpha";

  // dieditOleh hanya terisi saat Admin benar-benar melakukan override manual.
  if (absensi.dieditOleh != null) {
    return absensi.statusFinal || absensi.statusOtomatis || "alpha";
  }

  // Status otomatis selalu dihitung dari jam masuk aktual agar perubahan
  // pengaturan batas waktu tidak dikunci oleh statusFinal lama.
  const statusDariWaktu = statusOtomatisDariWaktu(
    absensi.jamMasuk,
    jamMasukStandar,
  );

  return statusDariWaktu || absensi.statusOtomatis || absensi.statusFinal || "alpha";
}

module.exports = {
  TIMEZONE,
  bagianWaktuWIB,
  tanggalHariIniWIB,
  jamSekarangWIB,
  tahunBulanSekarangWIB,
  sekarangWIB,
  JAM_MASUK_STANDAR_DEFAULT,
  jamKeMenit,
  menitWIB,
  statusOtomatisDariWaktu,
  statusEfektif,
};
