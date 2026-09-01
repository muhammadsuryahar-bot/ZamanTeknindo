const prisma = require("../utils/prismaClient");

async function daftarKaryawanFixed(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: {
        peran: "karyawan",
        statusAkun: { not: "menunggu_konfirmasi" },
      },
      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
        kantorId: true,
        statusAkun: true,
        kantor: {
          select: {
            id: true,
            namaKantor: true,
          },
        },
      },
      orderBy: { nama: "asc" },
    });

    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil daftar karyawan:", error);
    return res.status(500).json({ pesan: "Gagal memuat daftar karyawan." });
  }
}

module.exports = { daftarKaryawanFixed };
