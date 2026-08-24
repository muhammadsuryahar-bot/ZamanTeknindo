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

// PENTING: dua fungsi di bawah ini dibutuhkan oleh hitungGajiController.js
// dan exportGajiController.js (dipakai buat nentuin "bulan & tahun berjalan"
// versi WIB, bukan waktu lokal server). Sempat kehapus pas file ini
// ditulis ulang -- tanpa ini, SEMUA fitur Gaji (hitung, lihat laporan,
// export Excel) langsung crash "is not a function" begitu dipanggil.
function tahunBulanSekarangWIB(date = new Date()) {
  const wib = bagianWaktuWIB(date);
  return { tahun: wib.tahun, bulan: wib.bulan };
}

function sekarangWIB(date = new Date()) {
  return bagianWaktuWIB(date);
}

module.exports = {
  TIMEZONE,
  bagianWaktuWIB,
  tanggalHariIniWIB,
  jamSekarangWIB,
  tahunBulanSekarangWIB,
  sekarangWIB,
};
