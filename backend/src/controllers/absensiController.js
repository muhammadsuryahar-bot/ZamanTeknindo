const prisma = require("../utils/prismaClient");
const {
  tanggalHariIniWIB,
  jamSekarangWIB,
} = require("../utils/waktuIndonesia");
const { deleteFotoAbsensi } = require("../utils/supabaseStorage");

// Batas default tepat waktu absensi masuk: 08:10 WIB.
// Nilai aktual dibaca dari PengaturanPotongan.jamMasukStandar agar
// pengaturan Admin di halaman Gaji benar-benar dipakai oleh absensi.
const JAM_BATAS_TEPAT_WAKTU_DEFAULT = "08:10:00";

function tanggalHariIni() {
  return tanggalHariIniWIB();
}

function jamKeMenit(jam) {
  const bagian = String(jam || "").split(":").map(Number);
  if (bagian.length < 2 || bagian.some((n) => Number.isNaN(n))) return null;
  const [jamAngka, menit, detik = 0] = bagian;
  if (jamAngka < 0 || jamAngka > 23 || menit < 0 || menit > 59 || detik < 0 || detik > 59) return null;
  return jamAngka * 60 + menit + detik / 60;
}

async function ambilBatasTepatWaktu() {
  try {
    const pengaturan = await prisma.pengaturanPotongan.findUnique({
      where: { id: 1 },
      select: { jamMasukStandar: true },
    });
    return jamKeMenit(pengaturan?.jamMasukStandar) ?? jamKeMenit(JAM_BATAS_TEPAT_WAKTU_DEFAULT);
  } catch (error) {
    console.error("Gagal membaca batas tepat waktu dari pengaturan:", error);
    return jamKeMenit(JAM_BATAS_TEPAT_WAKTU_DEFAULT);
  }
}

function koordinatDariRequest(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { latitude: null, longitude: null };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { latitude: null, longitude: null };
  return { latitude: lat, longitude: lng };
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
    const batasTepatWaktu = await ambilBatasTepatWaktu();
    const statusOtomatis = jamSekarang <= batasTepatWaktu ? "tepat_waktu" : "telat";
    const koordinat = koordinatDariRequest(latitude, longitude);

    const data = {
      jamMasuk: sekarang,
      fotoMasuk: fotoPath,
      latitudeMasuk: koordinat.latitude,
      longitudeMasuk: koordinat.longitude,
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

    const koordinat = koordinatDariRequest(latitude, longitude);

    const absensi = await prisma.absensi.update({
      where: { id: absensiHariIni.id },
      data: {
        jamPulang: tentukanJamAbsen(waktuAsli),
        fotoPulang: fotoPath,
        latitudePulang: koordinat.latitude,
        longitudePulang: koordinat.longitude,
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