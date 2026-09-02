const { jamSekarangWIB } = require("./waktuIndonesia");

const JAM_MASUK_STANDAR_DEFAULT = "08:10:00";

function jamKeMenit(jam) {
  const bagian = String(jam || "").split(":").map(Number);
  if (bagian.length < 2 || bagian.some((n) => Number.isNaN(n))) return null;

  const [hour, minute] = bagian;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  // Aturan keterlambatan berbasis MENIT:
  // detik diabaikan, sehingga seluruh menit 08:10 tetap tepat waktu.
  return hour * 60 + minute;
}

function menitWIB(date = new Date()) {
  return Math.floor(jamSekarangWIB(date) * 60);
}

function statusOtomatisDariWaktu(waktu, jamMasukStandar = JAM_MASUK_STANDAR_DEFAULT) {
  if (!waktu) return null;

  const date = waktu instanceof Date ? waktu : new Date(waktu);
  if (Number.isNaN(date.getTime())) return null;

  const batas = jamKeMenit(jamMasukStandar) ?? jamKeMenit(JAM_MASUK_STANDAR_DEFAULT);
  return menitWIB(date) <= batas ? "tepat_waktu" : "telat";
}

function statusEfektif(absensi, jamMasukStandar = JAM_MASUK_STANDAR_DEFAULT) {
  if (!absensi) return "alpha";

  // dieditOleh adalah penanda bahwa Admin memang melakukan override manual.
  if (absensi.dieditOleh != null) {
    return absensi.statusFinal || absensi.statusOtomatis || "alpha";
  }

  // Untuk status otomatis, hitung ulang dari waktu masuk dan aturan terbaru.
  // Ini mencegah statusFinal lama mengunci hasil otomatis.
  const statusDariWaktu = statusOtomatisDariWaktu(absensi.jamMasuk, jamMasukStandar);
  return statusDariWaktu || absensi.statusOtomatis || absensi.statusFinal || "alpha";
}

module.exports = {
  JAM_MASUK_STANDAR_DEFAULT,
  jamKeMenit,
  menitWIB,
  statusOtomatisDariWaktu,
  statusEfektif,
};
