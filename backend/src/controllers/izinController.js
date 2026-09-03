const prisma = require("../utils/prismaClient");
const { deleteFotoAbsensi, buatSignedUrlFotoBatch } = require("../utils/supabaseStorage");
const { kirimPushKePengguna, kirimPushKeSemuaAdmin } = require("../utils/pushNotification");

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

function tambahUrlLampiran(item, petaUrl) {
  if (!item?.fotoSurat) return item;
  return {
    ...item,
    fotoSuratUrl: item.fotoSurat.startsWith("/uploads/")
      ? item.fotoSurat
      : petaUrl.get(item.fotoSurat) || null,
  };
}

function formatTanggal(tanggal) {
  return new Date(tanggal).toLocaleDateString("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function ajukanIzin(req, res) {
  let fotoTersimpanDiDatabase = false;
  const fotoSurat = req.file ? req.file.filename : null;

  async function hapusFotoJikaPerlu() {
    if (fotoSurat && !fotoTersimpanDiDatabase) await deleteFotoAbsensi(fotoSurat);
  }

  try {
    const { tanggal, jenis, keterangan } = req.body;
    const penggunaId = req.user.id;
    const tanggalNormal = normalisasiTanggal(tanggal);

    if (!tanggalNormal || !jenis || !String(keterangan || "").trim()) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({ pesan: "Tanggal, jenis, dan keterangan wajib diisi dengan benar." });
    }

    const jenisValid = ["izin", "sakit", "cuti", "urgent"];
    if (!jenisValid.includes(jenis)) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({ pesan: "Jenis pengajuan tidak valid." });
    }

    if (jenis === "sakit" && !req.file) {
      return res.status(400).json({ pesan: "Untuk pengajuan Sakit, surat sakit wajib dilampirkan dalam bentuk foto atau PDF." });
    }

    const tanggalDate = tanggalSebagaiDate(tanggalNormal);
    const pengajuanAktif = await prisma.pengajuanIzin.findFirst({
      where: { penggunaId, tanggal: tanggalDate, status: { in: ["menunggu", "disetujui"] } },
    });

    if (pengajuanAktif) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({ pesan: "Kamu sudah memiliki pengajuan aktif untuk tanggal tersebut. Selesaikan pengajuan yang ada terlebih dahulu." });
    }

    const pengguna = await prisma.pengguna.findUnique({
      where: { id: penggunaId },
      select: { nama: true },
    });

    const izin = await prisma.pengajuanIzin.create({
      data: {
        penggunaId,
        tanggal: tanggalDate,
        jenis,
        keterangan: String(keterangan).trim(),
        fotoSurat,
        status: "menunggu",
      },
    });

    fotoTersimpanDiDatabase = true;

    // Push dikirim setelah data aman tersimpan. Kegagalan push tidak boleh
    // membuat pengajuan izin gagal.
    void kirimPushKeSemuaAdmin({
      title: "Zaman Teknindo — Pengajuan Baru",
      body: `${pengguna?.nama || "Karyawan"} mengajukan ${jenis} untuk ${formatTanggal(tanggalDate)}.`,
      tag: `admin-izin-${izin.id}`,
      url: "/admin",
      renotify: true,
    }).catch((error) => console.error("Push pengajuan izin gagal:", error));

    return res.status(201).json({
      pesan: "Pengajuan berhasil dikirim, menunggu persetujuan Admin.",
      data: izin,
    });
  } catch (error) {
    console.error("Gagal membuat pengajuan izin:", error);
    await hapusFotoJikaPerlu();

    if (error?.code === "P2002") {
      return res.status(400).json({ pesan: "Kamu sudah memiliki pengajuan aktif untuk tanggal tersebut. Selesaikan pengajuan yang ada terlebih dahulu." });
    }

    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function riwayatIzinSaya(req, res) {
  try {
    const penggunaId = req.user.id;
    const data = await prisma.pengajuanIzin.findMany({
      where: { penggunaId },
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
    });

    const paths = data.map((item) => item.fotoSurat).filter((path) => path && !path.startsWith("/uploads/"));
    const petaUrl = await buatSignedUrlFotoBatch(paths);

    return res.json({ data: data.map((item) => tambahUrlLampiran(item, petaUrl)) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function daftarSemuaIzin(req, res) {
  try {
    const { status } = req.query;
    const statusValid = ["menunggu", "disetujui", "ditolak"];
    if (status && !statusValid.includes(status)) return res.status(400).json({ pesan: "Status pengajuan tidak valid." });

    const data = await prisma.pengajuanIzin.findMany({
      where: status ? { status } : {},
      include: { pengguna: { select: { nama: true, jabatan: true, divisi: true } } },
      orderBy: [{ dibuatPada: "desc" }, { id: "desc" }],
    });

    const paths = data.map((item) => item.fotoSurat).filter((path) => path && !path.startsWith("/uploads/"));
    const petaUrl = await buatSignedUrlFotoBatch(paths);
    return res.json({ data: data.map((item) => tambahUrlLampiran(item, petaUrl)) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function setujuiIzin(req, res) {
  try {
    const idPengajuan = parseInt(req.params.id, 10);
    const { catatanAdmin } = req.body;
    const adminId = req.user.id;
    if (!Number.isInteger(idPengajuan)) return res.status(400).json({ pesan: "ID pengajuan tidak valid." });

    const izin = await prisma.pengajuanIzin.findUnique({
      where: { id: idPengajuan },
      include: { pengguna: { select: { nama: true } } },
    });
    if (!izin) return res.status(404).json({ pesan: "Pengajuan tidak ditemukan." });
    if (izin.status !== "menunggu") return res.status(400).json({ pesan: "Pengajuan ini sudah diproses sebelumnya." });

    const waktuProses = new Date();
    const hasil = await prisma.$transaction(async (tx) => {
      const izinDiupdate = await tx.pengajuanIzin.update({
        where: { id: idPengajuan },
        data: { status: "disetujui", diprosesOleh: adminId, waktuProses, catatanAdmin: catatanAdmin || null },
      });
      const absensi = await tx.absensi.upsert({
        where: { penggunaId_tanggal: { penggunaId: izin.penggunaId, tanggal: izin.tanggal } },
        update: { statusFinal: izin.jenis, catatanAdmin: `Disetujui sebagai ${izin.jenis} (pengajuan #${izin.id})`, dieditOleh: adminId, waktuEdit: waktuProses },
        create: { penggunaId: izin.penggunaId, tanggal: izin.tanggal, statusFinal: izin.jenis, catatanAdmin: `Disetujui sebagai ${izin.jenis} (pengajuan #${izin.id})`, dieditOleh: adminId, waktuEdit: waktuProses },
      });
      return { izinDiupdate, absensi };
    });

    void kirimPushKePengguna(izin.penggunaId, {
      title: "Zaman Teknindo — Pengajuan Disetujui",
      body: `Pengajuan ${izin.jenis} tanggal ${formatTanggal(izin.tanggal)} telah disetujui Admin.`,
      tag: `karyawan-izin-disetujui-${izin.id}`,
      url: "/karyawan",
      renotify: true,
    }).catch((error) => console.error("Push persetujuan izin gagal:", error));

    return res.json({ pesan: "Pengajuan izin disetujui.", data: hasil.izinDiupdate });
  } catch (error) {
    console.error("Gagal menyetujui pengajuan izin:", error);
    return res.status(500).json({ pesan: "Gagal menyetujui pengajuan izin. Silakan coba lagi." });
  }
}

async function tolakIzin(req, res) {
  try {
    const idPengajuan = parseInt(req.params.id, 10);
    const { catatanAdmin } = req.body;
    const adminId = req.user.id;
    if (!Number.isInteger(idPengajuan)) return res.status(400).json({ pesan: "ID pengajuan tidak valid." });

    const izin = await prisma.pengajuanIzin.findUnique({
      where: { id: idPengajuan },
      include: { pengguna: { select: { nama: true } } },
    });
    if (!izin) return res.status(404).json({ pesan: "Pengajuan tidak ditemukan." });
    if (izin.status !== "menunggu") return res.status(400).json({ pesan: "Pengajuan ini sudah diproses sebelumnya." });

    const izinDiupdate = await prisma.pengajuanIzin.update({
      where: { id: idPengajuan },
      data: { status: "ditolak", diprosesOleh: adminId, waktuProses: new Date(), catatanAdmin: catatanAdmin || null },
    });

    void kirimPushKePengguna(izin.penggunaId, {
      title: "Zaman Teknindo — Pengajuan Ditolak",
      body: `Pengajuan ${izin.jenis} tanggal ${formatTanggal(izin.tanggal)} ditolak Admin.`,
      tag: `karyawan-izin-ditolak-${izin.id}`,
      url: "/karyawan",
      renotify: true,
    }).catch((error) => console.error("Push penolakan izin gagal:", error));

    return res.json({ pesan: "Pengajuan izin ditolak.", data: izinDiupdate });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

module.exports = { ajukanIzin, riwayatIzinSaya, daftarSemuaIzin, setujuiIzin, tolakIzin };
