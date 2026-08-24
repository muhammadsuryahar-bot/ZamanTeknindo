const prisma = require("../utils/prismaClient");

// ============================================================
// KARYAWAN — Ajukan izin/sakit/cuti/urgent
// ============================================================
async function ajukanIzin(req, res) {
  try {
    const { tanggal, jenis, keterangan } = req.body;
    const penggunaId = req.user.id;

    if (!tanggal || !jenis || !keterangan) {
      return res.status(400).json({ pesan: "Tanggal, jenis, dan keterangan wajib diisi." });
    }

    const jenisValid = ["izin", "sakit", "cuti", "urgent"];
    if (!jenisValid.includes(jenis)) {
      return res.status(400).json({ pesan: "Jenis pengajuan tidak valid." });
    }

    // Sakit wajib lampirkan foto surat, sesuai dokumen sistem
    if (jenis === "sakit" && !req.file) {
      return res.status(400).json({ pesan: "Untuk pengajuan Sakit, foto surat sakit wajib dilampirkan." });
    }

    const fotoSurat = req.file ? req.file.filename : null;

    const izin = await prisma.pengajuanIzin.create({
      data: {
        penggunaId,
        tanggal: new Date(tanggal),
        jenis,
        keterangan,
        fotoSurat,
        status: "menunggu",
      },
    });

    return res.status(201).json({
      pesan: "Pengajuan berhasil dikirim, menunggu persetujuan Admin.",
      data: izin,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// KARYAWAN — Lihat riwayat pengajuan izin miliknya sendiri
// ============================================================
async function riwayatIzinSaya(req, res) {
  try {
    const penggunaId = req.user.id;

    const data = await prisma.pengajuanIzin.findMany({
      where: { penggunaId },
      orderBy: { tanggal: "desc" },
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// ADMIN — Lihat semua pengajuan izin (bisa difilter status)
// ============================================================
async function daftarSemuaIzin(req, res) {
  try {
    const { status } = req.query; // ?status=menunggu (opsional)

    const data = await prisma.pengajuanIzin.findMany({
      where: status ? { status } : {},
      include: {
        pengguna: { select: { nama: true, jabatan: true, divisi: true } },
      },
      orderBy: { dibuatPada: "desc" },
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// ADMIN — Setujui pengajuan izin
// Otomatis update status_final di tabel absensi hari itu jadi
// izin/sakit/cuti/urgent, supaya gajinya gak ikut terpotong
// ============================================================
async function setujuiIzin(req, res) {
  try {
    const { id } = req.params;
    const { catatanAdmin } = req.body;
    const adminId = req.user.id;

    const izin = await prisma.pengajuanIzin.findUnique({ where: { id: parseInt(id) } });
    if (!izin) {
      return res.status(404).json({ pesan: "Pengajuan tidak ditemukan." });
    }
    if (izin.status !== "menunggu") {
      return res.status(400).json({ pesan: "Pengajuan ini sudah diproses sebelumnya." });
    }

    const izinDiupdate = await prisma.pengajuanIzin.update({
      where: { id: parseInt(id) },
      data: {
        status: "disetujui",
        diprosesOleh: adminId,
        waktuProses: new Date(),
        catatanAdmin: catatanAdmin || null,
      },
    });

    // Cari/buat baris absensi hari itu, langsung set statusFinal sesuai
    // jenis izin (izin/sakit/cuti/urgent). Ini jadi SATU-SATUNYA sumber
    // status kehadiran yang dipakai buat hitung gaji & laporan nanti —
    // gak perlu cek tabel pengajuan_izin terpisah lagi.
    await prisma.absensi.upsert({
      where: {
        penggunaId_tanggal: {
          penggunaId: izin.penggunaId,
          tanggal: izin.tanggal,
        },
      },
      update: {
        statusFinal: izin.jenis, // "izin" | "sakit" | "cuti" | "urgent"
        catatanAdmin: `Disetujui sebagai ${izin.jenis} (pengajuan #${izin.id})`,
        dieditOleh: adminId,
        waktuEdit: new Date(),
      },
      create: {
        penggunaId: izin.penggunaId,
        tanggal: izin.tanggal,
        statusFinal: izin.jenis,
        catatanAdmin: `Disetujui sebagai ${izin.jenis} (pengajuan #${izin.id})`,
        dieditOleh: adminId,
        waktuEdit: new Date(),
      },
    });

    return res.json({ pesan: "Pengajuan izin disetujui.", data: izinDiupdate });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// ADMIN — Tolak pengajuan izin
// ============================================================
async function tolakIzin(req, res) {
  try {
    const { id } = req.params;
    const { catatanAdmin } = req.body;
    const adminId = req.user.id;

    const izin = await prisma.pengajuanIzin.findUnique({ where: { id: parseInt(id) } });
    if (!izin) {
      return res.status(404).json({ pesan: "Pengajuan tidak ditemukan." });
    }
    if (izin.status !== "menunggu") {
      return res.status(400).json({ pesan: "Pengajuan ini sudah diproses sebelumnya." });
    }

    const izinDiupdate = await prisma.pengajuanIzin.update({
      where: { id: parseInt(id) },
      data: {
        status: "ditolak",
        diprosesOleh: adminId,
        waktuProses: new Date(),
        catatanAdmin: catatanAdmin || null,
      },
    });

    return res.json({ pesan: "Pengajuan izin ditolak.", data: izinDiupdate });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

module.exports = {
  ajukanIzin,
  riwayatIzinSaya,
  daftarSemuaIzin,
  setujuiIzin,
  tolakIzin,
};
