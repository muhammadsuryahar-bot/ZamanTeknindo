const prisma = require("../utils/prismaClient");

async function aktifkanAkunFixed(req, res) {
  try {
    const id = Number.parseInt(String(req.params.id), 10);
    const jabatan = String(req.body?.jabatan || "").trim();
    const divisi = String(req.body?.divisi || "").trim();
    const kantorId = Number.parseInt(String(req.body?.kantorId || ""), 10);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ pesan: "ID akun tidak valid." });
    }
    if (!jabatan || !divisi) {
      return res.status(400).json({ pesan: "Jabatan dan divisi wajib diisi." });
    }
    if (!Number.isInteger(kantorId) || kantorId <= 0) {
      return res.status(400).json({ pesan: "Kantor kerja wajib dipilih agar akun tidak salah ditempatkan." });
    }

    const [akun, kantor] = await Promise.all([
      prisma.pengguna.findUnique({ where: { id } }),
      prisma.kantor.findUnique({ where: { id: kantorId }, select: { id: true, namaKantor: true } }),
    ]);

    if (!akun) return res.status(404).json({ pesan: "Akun karyawan tidak ditemukan." });
    if (akun.peran !== "karyawan") return res.status(400).json({ pesan: "Hanya akun karyawan yang dapat diaktifkan." });
    if (!kantor) return res.status(400).json({ pesan: "Kantor yang dipilih tidak ditemukan." });

    const pengguna = await prisma.pengguna.update({
      where: { id },
      data: {
        jabatan,
        divisi,
        kantorId: kantor.id,
        statusAkun: "aktif",
      },
      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
        kantorId: true,
        statusAkun: true,
      },
    });

    return res.json({
      pesan: `Akun ${pengguna.nama} berhasil diaktifkan di ${kantor.namaKantor}.`,
      data: pengguna,
      kantor: kantor.namaKantor,
    });
  } catch (error) {
    console.error("Gagal mengaktifkan akun:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan saat mengaktifkan akun." });
  }
}

module.exports = { aktifkanAkunFixed };
