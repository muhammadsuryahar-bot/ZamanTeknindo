const prisma = require("../utils/prismaClient");
const {
  tanggalHariIniWIB,
  jamSekarangWIB,
} = require("../utils/waktuIndonesia");
const { deleteFotoAbsensi } = require("../utils/supabaseStorage");

// Batas tepat waktu absensi masuk: 08:10 WIB. Tidak mengambil konfigurasi
// database pada setiap absensi agar request lebih ringan dan aturan konsisten.
const JAM_BATAS_TEPAT_WAKTU = 8 + 10 / 60;

function tanggalHariIni() {
  return tanggalHariIniWIB();
}

function tentukanJamAbsen(waktuAsliDariKlien) {
  const sekarang = new Date();
  if (!waktuAsliDariKlien) return sekarang;

  const waktuKlien = new Date(waktuAsliDariKlien);
  if (isNaN(waktuKlien.getTime())) return sekarang;

  const batasMundur = new Date(sekarang.getTime() - 12 * 60 * 60 * 1000);
  if (waktuKlien > sekarang || waktuKlien < batasMundur) return sekarang;

  return waktuKlien;
}

async function absenMasuk(req, res) {
  const fotoPath = req.file?.filename || null;
  let fotoTersimpanDiDatabase = false;

  async function hapusFotoJikaPerlu() {
    if (fotoPath && !fotoTersimpanDiDatabase) {
      await deleteFotoAbsensi(fotoPath);
    }
  }

  try {
    const penggunaId = req.user.id;
    const { latitude, longitude, alamat, waktuAsli } = req.body;

    if (!req.file) {
      return res.status(400).json({ pesan: "Foto absen wajib diunggah." });
    }

    const tanggal = tanggalHariIni();

    const pengajuanDisetujui = await prisma.pengajuanIzin.findFirst({
      where: { penggunaId, tanggal, status: "disetujui" },
      select: { id: true, jenis: true, tanggal: true },
    });

    if (pengajuanDisetujui) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({
        pesan: `Absensi tidak diperlukan. Pengajuan ${pengajuanDisetujui.jenis} kamu untuk hari ini sudah disetujui Admin.`,
        jenisPengajuan: pengajuanDisetujui.jenis,
      });
    }

    const sudahAbsen = await prisma.absensi.findUnique({
      where: { penggunaId_tanggal: { penggunaId, tanggal } },
    });

    if (sudahAbsen && sudahAbsen.jamMasuk) {
      await hapusFotoJikaPerlu();
      return res.status(409).json({ pesan: "Anda sudah melakukan absen masuk hari ini." });
    }

    const sekarang = tentukanJamAbsen(waktuAsli);
    const jamSekarang = jamSekarangWIB(sekarang);
    const statusOtomatis = jamSekarang <= JAM_BATAS_TEPAT_WAKTU ? "tepat_waktu" : "telat";

    const data = {
      jamMasuk: sekarang,
      fotoMasuk: fotoPath,
      latitudeMasuk: latitude ? parseFloat(latitude) : null,
      longitudeMasuk: longitude ? parseFloat(longitude) : null,
      alamatMasuk: alamat || null,
      statusOtomatis,
      statusFinal: statusOtomatis,
    };

    let absensi;
    if (sudahAbsen) {
      absensi = await prisma.absensi.update({ where: { id: sudahAbsen.id }, data });
    } else {
      try {
        absensi = await prisma.absensi.create({ data: { penggunaId, tanggal, ...data } });
      } catch (error) {
        // Unique [penggunaId, tanggal] mencegah dua tap bersamaan membuat dua record.
        if (error?.code === "P2002") {
          await hapusFotoJikaPerlu();
          return res.status(409).json({ pesan: "Absensi masuk sudah tercatat. Silakan periksa status hari ini." });
        }
        throw error;
      }
    }

    fotoTersimpanDiDatabase = true;
    return res.status(201).json({
      pesan: `Absen masuk berhasil! Status: ${statusOtomatis === "tepat_waktu" ? "Tepat Waktu" : "Telat"}.`,
      data: absensi,
    });
  } catch (error) {
    console.error("Gagal memproses absen masuk:", error);
    await hapusFotoJikaPerlu();
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function absenPulang(req, res) {
  const fotoPath = req.file?.filename || null;
  let fotoTersimpanDiDatabase = false;

  async function hapusFotoJikaPerlu() {
    if (fotoPath && !fotoTersimpanDiDatabase) {
      await deleteFotoAbsensi(fotoPath);
    }
  }

  try {
    const penggunaId = req.user.id;
    const { latitude, longitude, alamat, waktuAsli } = req.body;

    if (!req.file) return res.status(400).json({ pesan: "Foto absen wajib diunggah." });

    const tanggal = tanggalHariIni();
    const pengajuanDisetujui = await prisma.pengajuanIzin.findFirst({
      where: { penggunaId, tanggal, status: "disetujui" },
      select: { id: true, jenis: true, tanggal: true },
    });

    if (pengajuanDisetujui) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({
        pesan: `Absensi tidak diperlukan. Pengajuan ${pengajuanDisetujui.jenis} kamu untuk hari ini sudah disetujui Admin.`,
        jenisPengajuan: pengajuanDisetujui.jenis,
      });
    }

    const absensiHariIni = await prisma.absensi.findUnique({
      where: { penggunaId_tanggal: { penggunaId, tanggal } },
    });

    if (!absensiHariIni || !absensiHariIni.jamMasuk) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({ pesan: "Anda belum melakukan absen masuk hari ini." });
    }

    if (absensiHariIni.jamPulang) {
      await hapusFotoJikaPerlu();
      return res.status(409).json({ pesan: "Anda sudah melakukan absen pulang hari ini." });
    }

    const absensi = await prisma.absensi.update({
      where: { id: absensiHariIni.id },
      data: {
        jamPulang: tentukanJamAbsen(waktuAsli),
        fotoPulang: fotoPath,
        latitudePulang: latitude ? parseFloat(latitude) : null,
        longitudePulang: longitude ? parseFloat(longitude) : null,
        alamatPulang: alamat || null,
      },
    });

    fotoTersimpanDiDatabase = true;
    return res.status(200).json({ pesan: "Absen pulang berhasil! Terima kasih.", data: absensi });
  } catch (error) {
    console.error("Gagal memproses absen pulang:", error);
    await hapusFotoJikaPerlu();
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function riwayatSaya(req, res) {
  try {
    const riwayat = await prisma.absensi.findMany({
      where: { penggunaId: req.user.id },
      orderBy: { tanggal: "desc" },
      take: 31,
    });
    return res.json({ data: riwayat });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function statusHariIni(req, res) {
  try {
    const penggunaId = req.user.id;
    const tanggal = tanggalHariIni();

    const [absensi, pengajuanDisetujui] = await Promise.all([
      prisma.absensi.findUnique({ where: { penggunaId_tanggal: { penggunaId, tanggal } } }),
      prisma.pengajuanIzin.findFirst({
        where: { penggunaId, tanggal, status: "disetujui" },
        select: { id: true, jenis: true, tanggal: true, keterangan: true, status: true },
      }),
    ]);

    if (pengajuanDisetujui) {
      return res.json({ tahap: "tidak_perlu_absen", data: absensi || null, pengajuanIzin: pengajuanDisetujui });
    }

    let tahap = "belum_masuk";
    if (absensi?.jamMasuk && !absensi?.jamPulang) tahap = "sudah_masuk";
    if (absensi?.jamMasuk && absensi?.jamPulang) tahap = "selesai";

    return res.json({ tahap, data: absensi || null, pengajuanIzin: null });
  } catch (error) {
    console.error("Gagal memuat status absensi hari ini:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

module.exports = { absenMasuk, absenPulang, riwayatSaya, statusHariIni };
