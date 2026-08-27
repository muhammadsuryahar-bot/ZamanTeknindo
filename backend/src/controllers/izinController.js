const prisma = require("../utils/prismaClient");
const { deleteFotoAbsensi } = require("../utils/supabaseStorage");

// ============================================================
// KARYAWAN — Ajukan izin/sakit/cuti/urgent
// ============================================================
async function ajukanIzin(req, res) {
  let fotoTersimpanDiDatabase = false;
  const fotoSurat = req.file ? req.file.filename : null;

  async function hapusFotoJikaPerlu() {
    if (fotoSurat && !fotoTersimpanDiDatabase) {
      await deleteFotoAbsensi(fotoSurat);
    }
  }

  try {
    const { tanggal, jenis, keterangan } = req.body;
    const penggunaId = req.user.id;

    if (!tanggal || !jenis || !keterangan) {
      await hapusFotoJikaPerlu();
      return res
        .status(400)
        .json({ pesan: "Tanggal, jenis, dan keterangan wajib diisi." });
    }

    const jenisValid = ["izin", "sakit", "cuti", "urgent"];
    if (!jenisValid.includes(jenis)) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({ pesan: "Jenis pengajuan tidak valid." });
    }

    // Sakit wajib lampirkan foto surat, sesuai dokumen sistem
    if (jenis === "sakit" && !req.file) {
      return res.status(400).json({
        pesan: "Untuk pengajuan Sakit, foto surat sakit wajib dilampirkan.",
      });
    }

    // ============================================================
    // CEK PENGAJUAN AKTIF
    //
    // Pemeriksaan ini memberi pesan yang ramah untuk kasus normal.
    // Perlindungan sebenarnya diperkuat lagi oleh partial unique
    // index di database, sehingga race condition antar-request
    // tetap aman.
    // ============================================================
    const pengajuanAktif = await prisma.pengajuanIzin.findFirst({
      where: {
        penggunaId,
        tanggal: new Date(tanggal),
        status: {
          in: ["menunggu", "disetujui"],
        },
      },
    });

    if (pengajuanAktif) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({
        pesan:
          "Kamu sudah memiliki pengajuan aktif untuk tanggal tersebut. Selesaikan pengajuan yang ada terlebih dahulu.",
      });
    }

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

    fotoTersimpanDiDatabase = true;

    return res.status(201).json({
      pesan: "Pengajuan berhasil dikirim, menunggu persetujuan Admin.",
      data: izin,
    });
  } catch (error) {
    console.error("Gagal membuat pengajuan izin:", error);

    // P2002 = unique constraint. Ini terutama menangani dua request
    // bersamaan yang lolos dari findFirst secara bersamaan.
    if (error?.code === "P2002") {
      await hapusFotoJikaPerlu();
      return res.status(400).json({
        pesan:
          "Kamu sudah memiliki pengajuan aktif untuk tanggal tersebut. Selesaikan pengajuan yang ada terlebih dahulu.",
      });
    }

    await hapusFotoJikaPerlu();

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
    });
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
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
    });
  }
}

// ============================================================
// ADMIN — Lihat semua pengajuan izin (bisa difilter status)
// ============================================================
async function daftarSemuaIzin(req, res) {
  try {
    const { status } = req.query;
    const statusValid = ["menunggu", "disetujui", "ditolak"];

    if (status && !statusValid.includes(status)) {
      return res.status(400).json({ pesan: "Status pengajuan tidak valid." });
    }

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
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
    });
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
    const idPengajuan = parseInt(id);

    if (!Number.isInteger(idPengajuan)) {
      return res.status(400).json({ pesan: "ID pengajuan tidak valid." });
    }

    const izin = await prisma.pengajuanIzin.findUnique({
      where: { id: idPengajuan },
    });

    if (!izin) {
      return res.status(404).json({ pesan: "Pengajuan tidak ditemukan." });
    }

    if (izin.status !== "menunggu") {
      return res.status(400).json({
        pesan: "Pengajuan ini sudah diproses sebelumnya.",
      });
    }

    // ============================================================
    // UPDATE PENGAJUAN + ABSENSI DALAM SATU TRANSACTION
    // ============================================================
    const hasil = await prisma.$transaction(async (tx) => {
      const izinDiupdate = await tx.pengajuanIzin.update({
        where: { id: idPengajuan },
        data: {
          status: "disetujui",
          diprosesOleh: adminId,
          waktuProses: new Date(),
          catatanAdmin: catatanAdmin || null,
        },
      });

      const absensi = await tx.absensi.upsert({
        where: {
          penggunaId_tanggal: {
            penggunaId: izin.penggunaId,
            tanggal: izin.tanggal,
          },
        },
        update: {
          statusFinal: izin.jenis,
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

      return { izinDiupdate, absensi };
    });

    return res.json({
      pesan: "Pengajuan izin disetujui.",
      data: hasil.izinDiupdate,
    });
  } catch (error) {
    console.error("Gagal menyetujui pengajuan izin:", error);
    return res.status(500).json({
      pesan: "Gagal menyetujui pengajuan izin. Silakan coba lagi.",
    });
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
    const idPengajuan = parseInt(id);

    if (!Number.isInteger(idPengajuan)) {
      return res.status(400).json({ pesan: "ID pengajuan tidak valid." });
    }

    const izin = await prisma.pengajuanIzin.findUnique({
      where: { id: idPengajuan },
    });

    if (!izin) {
      return res.status(404).json({ pesan: "Pengajuan tidak ditemukan." });
    }

    if (izin.status !== "menunggu") {
      return res.status(400).json({
        pesan: "Pengajuan ini sudah diproses sebelumnya.",
      });
    }

    const izinDiupdate = await prisma.pengajuanIzin.update({
      where: { id: idPengajuan },
      data: {
        status: "ditolak",
        diprosesOleh: adminId,
        waktuProses: new Date(),
        catatanAdmin: catatanAdmin || null,
      },
    });

    return res.json({
      pesan: "Pengajuan izin ditolak.",
      data: izinDiupdate,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
    });
  }
}

module.exports = {
  ajukanIzin,
  riwayatIzinSaya,
  daftarSemuaIzin,
  setujuiIzin,
  tolakIzin,
};
