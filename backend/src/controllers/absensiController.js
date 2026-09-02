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
  if (
    jamAngka < 0 || jamAngka > 23 ||
    menit < 0 || menit > 59 ||
    detik < 0 || detik > 59
  ) return null;
  return jamAngka * 60 + menit + detik / 60;
}

async function ambilBatasTepatWaktu() {
  try {
    const pengaturan = await prisma.pengaturanPotongan.findUnique({
      where: { id: 1 },
      select: { jamMasukStandar: true },
    });
    return (
      jamKeMenit(pengaturan?.jamMasukStandar) ??
      jamKeMenit(JAM_BATAS_TEPAT_WAKTU_DEFAULT)
    );
  } catch (error) {
    console.error("Gagal membaca batas tepat waktu dari pengaturan:", error);
    return jamKeMenit(JAM_BATAS_TEPAT_WAKTU_DEFAULT);
  }
}

function koordinatDariRequest(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

// Waktu absensi ditetapkan oleh SERVER, bukan jam perangkat klien.
// Ini mencegah kasus perangkat menunjukkan 08:09 padahal waktu server sudah
// 08:11 WIB, yang sebelumnya bisa membuat status salah menjadi "tepat_waktu".
function waktuAbsensiServer() {
  return new Date();
}

async function absenMasuk(req, res) {
  const fotoPath = req.file?.filename || null;
  let fotoTersimpanDiDatabase = false;
  async function hapusFotoJikaPerlu() {
    if (fotoPath && !fotoTersimpanDiDatabase) await deleteFotoAbsensi(fotoPath);
  }

  try {
    const penggunaId = req.user.id;
    const { latitude, longitude, alamat } = req.body;
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

    const sudahAbsen = await prisma.absensi.findUnique({
      where: { penggunaId_tanggal: { penggunaId, tanggal } },
    });
    if (sudahAbsen && sudahAbsen.jamMasuk) {
      await hapusFotoJikaPerlu();
      return res.status(409).json({ pesan: "Anda sudah melakukan absen masuk hari ini." });
    }

    const waktuServer = waktuAbsensiServer();
    const jamServerWIB = jamSekarangWIB(waktuServer);
    const batasTepatWaktu = await ambilBatasTepatWaktu();

    // Batas bersifat INKLUSIF: tepat pada 08:10:00 masih tepat waktu,
    // mulai 08:10:01 sudah masuk kategori telat.
    const statusOtomatis = jamServerWIB <= batasTepatWaktu ? "tepat_waktu" : "telat";
    const koordinat = koordinatDariRequest(latitude, longitude);

    const data = {
      jamMasuk: waktuServer,
      fotoMasuk: fotoPath,
      latitudeMasuk: koordinat?.latitude ?? null,
      longitudeMasuk: koordinat?.longitude ?? null,
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
    if (fotoPath && !fotoTersimpanDiDatabase) await deleteFotoAbsensi(fotoPath);
  }

  try {
    const penggunaId = req.user.id;
    const { latitude, longitude, alamat } = req.body;
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
        jamPulang: waktuAbsensiServer(),
        fotoPulang: fotoPath,
        latitudePulang: koordinat?.latitude ?? null,
        longitudePulang: koordinat?.longitude ?? null,
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
      select: {
        id: true, tanggal: true, jamMasuk: true, jamPulang: true,
        fotoMasuk: true, fotoPulang: true,
        latitudeMasuk: true, longitudeMasuk: true, alamatMasuk: true,
        latitudePulang: true, longitudePulang: true, alamatPulang: true,
        statusOtomatis: true, statusFinal: true, catatanAdmin: true,
      },
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

    // Ambil status absensi + pengajuan izin yang disetujui dalam SATU
    // round-trip ke database. Ini mengurangi waktu tunggu pada production
    // yang memakai connection pool kecil dibanding dua query terpisah.
    const hasil = await prisma.$queryRaw`
      SELECT
        (
          SELECT jsonb_build_object(
            'id', a.id,
            'tanggal', a.tanggal,
            'jamMasuk', a.jam_masuk,
            'jamPulang', a.jam_pulang,
            'statusOtomatis', a.status_otomatis,
            'statusFinal', a.status_final
          )
          FROM absensi a
          WHERE a.pengguna_id = ${penggunaId}
            AND a.tanggal = ${tanggal}
          LIMIT 1
        ) AS "absensi",
        (
          SELECT jsonb_build_object(
            'id', p.id,
            'jenis', p.jenis,
            'tanggal', p.tanggal,
            'keterangan', p.keterangan,
            'status', p.status
          )
          FROM pengajuan_izin p
          WHERE p.pengguna_id = ${penggunaId}
            AND p.tanggal = ${tanggal}
            AND p.status = 'disetujui'
          ORDER BY p.id DESC
          LIMIT 1
        ) AS "pengajuan"
    `;

    const absensi = hasil?.[0]?.absensi || null;
    const pengajuanDisetujui = hasil?.[0]?.pengajuan || null;

    if (pengajuanDisetujui) {
      return res.json({
        tahap: "tidak_perlu_absen",
        data: absensi,
        pengajuanIzin: pengajuanDisetujui,
      });
    }

    let tahap = "belum_masuk";
    if (absensi?.jamMasuk && !absensi?.jamPulang) tahap = "sudah_masuk";
    if (absensi?.jamMasuk && absensi?.jamPulang) tahap = "selesai";

    return res.json({ tahap, data: absensi, pengajuanIzin: null });
  } catch (error) {
    console.error("Gagal memuat status absensi hari ini:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

module.exports = { absenMasuk, absenPulang, riwayatSaya, statusHariIni };
