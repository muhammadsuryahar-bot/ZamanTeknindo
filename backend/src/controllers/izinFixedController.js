const { Prisma } = require("@prisma/client");
const prisma = require("../utils/prismaClient");
const { deleteFotoAbsensi } = require("../utils/supabaseStorage");
const { kirimPushKePengguna, kirimPushKeSemuaAdmin } = require("../utils/pushNotification");
const { riwayatIzinSaya, daftarSemuaIzin } = require("./izinController");

function normalisasiTanggal(tanggal) {
  const nilai = String(tanggal || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return null;
  const [tahun, bulan, hari] = nilai.split("-").map(Number);
  const kandidat = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    kandidat.getUTCFullYear() !== tahun ||
    kandidat.getUTCMonth() !== bulan - 1 ||
    kandidat.getUTCDate() !== hari
  ) return null;
  return nilai;
}

function tanggalSebagaiDate(tanggal) {
  return new Date(`${tanggal}T00:00:00.000Z`);
}

function formatTanggal(tanggal) {
  return new Date(tanggal).toLocaleDateString("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function errorBisnis(kode, pesan) {
  const error = new Error(pesan);
  error.kodeBisnis = kode;
  return error;
}

async function ajukanIzinFixed(req, res) {
  let fotoTersimpanDiDatabase = false;
  const fotoSurat = req.file ? req.file.filename : null;

  async function hapusFotoJikaPerlu() {
    if (fotoSurat && !fotoTersimpanDiDatabase) {
      await deleteFotoAbsensi(fotoSurat);
    }
  }

  try {
    const { tanggal, jenis, keterangan } = req.body;
    const penggunaId = Number(req.user?.id);
    const tanggalNormal = normalisasiTanggal(tanggal);
    const keteranganBersih = String(keterangan || "").trim();

    if (!Number.isInteger(penggunaId) || penggunaId <= 0) {
      await hapusFotoJikaPerlu();
      return res.status(401).json({ pesan: "Sesi pengguna tidak valid." });
    }

    if (!tanggalNormal || !jenis || !keteranganBersih) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({ pesan: "Tanggal, jenis, dan keterangan wajib diisi dengan benar." });
    }

    const jenisValid = ["izin", "sakit", "cuti", "urgent"];
    if (!jenisValid.includes(jenis)) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({ pesan: "Jenis pengajuan tidak valid." });
    }

    if (keteranganBersih.length > 1000) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({ pesan: "Keterangan maksimal 1000 karakter." });
    }

    if (jenis === "sakit" && !req.file) {
      return res.status(400).json({ pesan: "Untuk pengajuan Sakit, surat sakit wajib dilampirkan dalam bentuk foto atau PDF." });
    }

    const tanggalDate = tanggalSebagaiDate(tanggalNormal);
    const pengguna = await prisma.pengguna.findUnique({
      where: { id: penggunaId },
      select: { nama: true, statusAkun: true },
    });

    if (!pengguna) {
      await hapusFotoJikaPerlu();
      return res.status(404).json({ pesan: "Akun pengguna tidak ditemukan." });
    }

    if (pengguna.statusAkun !== "aktif") {
      await hapusFotoJikaPerlu();
      return res.status(403).json({ pesan: "Akun kamu tidak aktif." });
    }

    const izin = await prisma.$transaction(
      async (tx) => {
        const pengajuanAktif = await tx.pengajuanIzin.findFirst({
          where: {
            penggunaId,
            tanggal: tanggalDate,
            status: { in: ["menunggu", "disetujui"] },
          },
          select: { id: true },
        });

        if (pengajuanAktif) {
          throw errorBisnis(
            "PENGAJUAN_AKTIF",
            "Kamu sudah memiliki pengajuan aktif untuk tanggal tersebut. Selesaikan pengajuan yang ada terlebih dahulu.",
          );
        }

        return tx.pengajuanIzin.create({
          data: {
            penggunaId,
            tanggal: tanggalDate,
            jenis,
            keterangan: keteranganBersih,
            fotoSurat,
            status: "menunggu",
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    fotoTersimpanDiDatabase = true;

    void kirimPushKeSemuaAdmin({
      title: "Zaman Teknindo — Pengajuan Baru",
      body: `${pengguna.nama} mengajukan ${jenis} untuk ${formatTanggal(tanggalDate)}.`,
      tag: `admin-izin-${izin.id}`,
      url: "/admin",
      renotify: true,
    }).catch((error) => console.error("Push pengajuan izin gagal:", error));

    return res.status(201).json({
      pesan: "Pengajuan berhasil dikirim, menunggu persetujuan Admin.",
      data: izin,
    });
  } catch (error) {
    await hapusFotoJikaPerlu().catch((cleanupError) =>
      console.error("Cleanup lampiran pengajuan gagal:", cleanupError),
    );

    if (error?.kodeBisnis === "PENGAJUAN_AKTIF") {
      return res.status(409).json({ pesan: error.message });
    }

    if (error?.code === "P2034") {
      return res.status(409).json({
        pesan: "Pengajuan lain untuk tanggal tersebut sedang diproses. Silakan coba lagi.",
      });
    }

    console.error("Gagal membuat pengajuan izin:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function prosesPersetujuan(idPengajuan, adminId, status, catatanAdmin) {
  const waktuProses = new Date();

  return prisma.$transaction(async (tx) => {
    const hasilUpdate = await tx.pengajuanIzin.updateMany({
      where: {
        id: idPengajuan,
        status: "menunggu",
      },
      data: {
        status,
        diprosesOleh: adminId,
        waktuProses,
        catatanAdmin: catatanAdmin || null,
      },
    });

    if (hasilUpdate.count === 0) {
      const current = await tx.pengajuanIzin.findUnique({
        where: { id: idPengajuan },
        select: { id: true, status: true },
      });

      if (!current) throw errorBisnis("TIDAK_DITEMUKAN", "Pengajuan tidak ditemukan.");
      throw errorBisnis(
        "SUDAH_DIPROSES",
        "Pengajuan ini sudah diproses sebelumnya.",
      );
    }

    const izin = await tx.pengajuanIzin.findUnique({
      where: { id: idPengajuan },
      include: { pengguna: { select: { nama: true } } },
    });

    if (!izin) throw errorBisnis("TIDAK_DITEMUKAN", "Pengajuan tidak ditemukan.");

    if (status === "disetujui") {
      await tx.absensi.upsert({
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
          waktuEdit: waktuProses,
        },
        create: {
          penggunaId: izin.penggunaId,
          tanggal: izin.tanggal,
          statusFinal: izin.jenis,
          catatanAdmin: `Disetujui sebagai ${izin.jenis} (pengajuan #${izin.id})`,
          dieditOleh: adminId,
          waktuEdit: waktuProses,
        },
      });
    }

    return izin;
  });
}

async function setujuiIzinFixed(req, res) {
  try {
    const idPengajuan = Number.parseInt(req.params.id, 10);
    const adminId = Number(req.user?.id);
    const catatanAdmin = String(req.body?.catatanAdmin || "").trim();

    if (!Number.isInteger(idPengajuan) || idPengajuan <= 0) {
      return res.status(400).json({ pesan: "ID pengajuan tidak valid." });
    }
    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({ pesan: "Sesi Admin tidak valid." });
    }
    if (catatanAdmin.length > 1000) {
      return res.status(400).json({ pesan: "Catatan Admin maksimal 1000 karakter." });
    }

    let hasil;
    try {
      hasil = await prosesPersetujuan(
        idPengajuan,
        adminId,
        "disetujui",
        catatanAdmin,
      );
    } catch (error) {
      if (error?.kodeBisnis === "TIDAK_DITEMUKAN") {
        return res.status(404).json({ pesan: error.message });
      }
      if (error?.kodeBisnis === "SUDAH_DIPROSES") {
        return res.status(409).json({ pesan: error.message });
      }
      throw error;
    }

    void kirimPushKePengguna(hasil.penggunaId, {
      title: "Zaman Teknindo — Pengajuan Disetujui",
      body: `Pengajuan ${hasil.jenis} tanggal ${formatTanggal(hasil.tanggal)} telah disetujui Admin.`,
      tag: `karyawan-izin-disetujui-${hasil.id}`,
      url: "/karyawan",
      renotify: true,
    }).catch((error) => console.error("Push persetujuan izin gagal:", error));

    return res.json({ pesan: "Pengajuan izin disetujui.", data: hasil });
  } catch (error) {
    console.error("Gagal menyetujui pengajuan izin:", error);
    if (error?.code === "P2034") {
      return res.status(409).json({ pesan: "Pengajuan sedang diproses oleh Admin lain. Silakan muat ulang data." });
    }
    return res.status(500).json({ pesan: "Gagal menyetujui pengajuan izin. Silakan coba lagi." });
  }
}

async function tolakIzinFixed(req, res) {
  try {
    const idPengajuan = Number.parseInt(req.params.id, 10);
    const adminId = Number(req.user?.id);
    const catatanAdmin = String(req.body?.catatanAdmin || "").trim();

    if (!Number.isInteger(idPengajuan) || idPengajuan <= 0) {
      return res.status(400).json({ pesan: "ID pengajuan tidak valid." });
    }
    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({ pesan: "Sesi Admin tidak valid." });
    }
    if (catatanAdmin.length > 1000) {
      return res.status(400).json({ pesan: "Catatan Admin maksimal 1000 karakter." });
    }

    let hasil;
    try {
      hasil = await prosesPersetujuan(
        idPengajuan,
        adminId,
        "ditolak",
        catatanAdmin,
      );
    } catch (error) {
      if (error?.kodeBisnis === "TIDAK_DITEMUKAN") {
        return res.status(404).json({ pesan: error.message });
      }
      if (error?.kodeBisnis === "SUDAH_DIPROSES") {
        return res.status(409).json({ pesan: error.message });
      }
      throw error;
    }

    void kirimPushKePengguna(hasil.penggunaId, {
      title: "Zaman Teknindo — Pengajuan Ditolak",
      body: `Pengajuan ${hasil.jenis} tanggal ${formatTanggal(hasil.tanggal)} ditolak Admin.`,
      tag: `karyawan-izin-ditolak-${hasil.id}`,
      url: "/karyawan",
      renotify: true,
    }).catch((error) => console.error("Push penolakan izin gagal:", error));

    return res.json({ pesan: "Pengajuan izin ditolak.", data: hasil });
  } catch (error) {
    console.error("Gagal menolak pengajuan izin:", error);
    if (error?.code === "P2034") {
      return res.status(409).json({ pesan: "Pengajuan sedang diproses oleh Admin lain. Silakan muat ulang data." });
    }
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

module.exports = {
  ajukanIzinFixed,
  riwayatIzinSaya,
  daftarSemuaIzin,
  setujuiIzinFixed,
  tolakIzinFixed,
};
