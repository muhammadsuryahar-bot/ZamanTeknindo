const prisma = require("./prismaClient");

// Ambil semua tanggal hari libur (nasional/cuti bersama) dalam SATU tahun,
// dikembalikan sebagai Set berisi string "YYYY-MM-DD" -- supaya gampang
// dicek pakai .has() saat loop tanggal di daftarHariKerja().
//
// Dipakai bareng oleh hitungGajiController.js (perhitungan gaji sungguhan)
// dan exportGajiController.js (laporan Excel), supaya keduanya konsisten:
// hari libur TIDAK dihitung sebagai "Alpha" walau jatuh di hari kerja biasa.
async function ambilSetHariLibur(tahun) {
  const daftar = await prisma.hariLibur.findMany({
    where: {
      tanggal: {
        gte: new Date(`${tahun}-01-01T00:00:00.000Z`),
        lte: new Date(`${tahun}-12-31T23:59:59.999Z`),
      },
    },
    select: { tanggal: true },
  });
  return new Set(daftar.map((h) => h.tanggal.toISOString().slice(0, 10)));
}

module.exports = { ambilSetHariLibur };
