const prisma = require("../utils/prismaClient");
const { tanggalHariIniWIB } = require("../utils/waktuIndonesia");
const { buatSignedUrlFotoBatch } = require("../utils/supabaseStorage");

async function rekapHariIniFixed(req, res) {
  try {
    const tanggal = tanggalHariIniWIB();

    const [data, karyawanAktif] = await Promise.all([
      prisma.absensi.findMany({
        where: { tanggal },
        include: {
          pengguna: {
            select: {
              id: true,
              nama: true,
              jabatan: true,
              divisi: true,
            },
          },
          kantorMasuk: {
            select: { id: true, namaKantor: true, alamat: true },
          },
          kantorPulang: {
            select: { id: true, namaKantor: true, alamat: true },
          },
        },
        orderBy: { jamMasuk: "asc" },
      }),
      prisma.pengguna.findMany({
        where: { peran: "karyawan", statusAkun: "aktif" },
        select: { id: true, nama: true, jabatan: true, divisi: true },
        orderBy: { nama: "asc" },
      }),
    ]);

    const semuaPathFoto = [];
    for (const item of data) {
      if (item.fotoMasuk && !item.fotoMasuk.startsWith("/uploads/")) semuaPathFoto.push(item.fotoMasuk);
      if (item.fotoPulang && !item.fotoPulang.startsWith("/uploads/")) semuaPathFoto.push(item.fotoPulang);
    }

    const petaUrlFoto = await buatSignedUrlFotoBatch(semuaPathFoto);

    const dataDenganKantor = data.map((item) => {
      const fotoMasukUrl = item.fotoMasuk
        ? item.fotoMasuk.startsWith("/uploads/")
          ? item.fotoMasuk
          : petaUrlFoto.get(item.fotoMasuk) || null
        : null;
      const fotoPulangUrl = item.fotoPulang
        ? item.fotoPulang.startsWith("/uploads/")
          ? item.fotoPulang
          : petaUrlFoto.get(item.fotoPulang) || null
        : null;

      const kantorNama = item.kantorMasuk?.namaKantor || null;
      const alamatAsli = item.alamatMasuk || null;
      const alamatTampilan = kantorNama
        ? `${kantorNama}${alamatAsli ? ` · ${alamatAsli}` : ""}`
        : alamatAsli || "Lokasi kantor belum teridentifikasi";

      return {
        ...item,
        fotoMasukUrl,
        fotoPulangUrl,
        // Dipakai UI lama tanpa perlu breaking change: kolom Lokasi sekarang
        // sekaligus menjelaskan kantor hasil GPS.
        alamatMasuk: alamatTampilan,
        kantorAbsensi: item.kantorMasuk
          ? { id: item.kantorMasuk.id, namaKantor: item.kantorMasuk.namaKantor }
          : null,
        kantorPulangAbsensi: item.kantorPulang
          ? { id: item.kantorPulang.id, namaKantor: item.kantorPulang.namaKantor }
          : null,
      };
    });

    const sudahAbsen = new Set(
      data.map((item) => item.pengguna?.id).filter((id) => id != null),
    );
    const belumAbsen = karyawanAktif.filter((karyawan) => !sudahAbsen.has(karyawan.id));

    return res.json({
      data: dataDenganKantor,
      belumAbsen,
      jumlahKaryawanAktif: karyawanAktif.length,
    });
  } catch (error) {
    console.error("Gagal mengambil rekap absensi dengan kantor aktual:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
}

module.exports = { rekapHariIniFixed };
