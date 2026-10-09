const prisma = require("../utils/prismaClient");
const {
  tanggalHariIniWIB,
  getWIBDateParts,
  parseJam,
  BATAS_ABSEN_MASUK_WIB,
} = require("../utils/waktuIndonesia");

function getWIBTodayRange() {
  const wibDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const start = new Date(`${wibDateStr}T00:00:00+07:00`);
  const end = new Date(`${wibDateStr}T23:59:59.999+07:00`);
  const tanggalDate = new Date(`${wibDateStr}T00:00:00.000Z`);
  return { wibDateStr, start, end, tanggalDate };
}
const { deleteFotoAbsensi } = require("../utils/supabaseStorage");

// Batas default tepat waktu absensi masuk: 08:10 WIB.
// Nilai aktual dibaca dari PengaturanPotongan.jamMasukStandar agar
// pengaturan Admin di halaman Gaji benar-benar dipakai oleh absensi.
const JAM_BATAS_TEPAT_WAKTU_DEFAULT = "08:10:00";
const HEADER_OFFLINE_SYNC = "X-Zaman-Background";
const OFFLINE_SYNC_HEADER_VALUE = "offline-sync";
const MAX_OFFLINE_CLOCK_DRIFT_MS = 24 * 60 * 60 * 1000;
const MAKS_AKURASI_LOKASI_METER = 100;
function koordinatDariRequest(latitude, longitude) {
  const latitudeRaw = String(latitude ?? "").trim();
  const longitudeRaw = String(longitude ?? "").trim();

  if (!latitudeRaw || !longitudeRaw) return null;

  const lat = Number(latitudeRaw);
  const lng = Number(longitudeRaw);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng,
  };
}

async function ambilBatasTepatWaktu() {
  try {
    const pengaturan = await prisma.pengaturanPotongan.findUnique({
      where: { id: 1 },
      select: { jamMasukStandar: true },
    });

    return parseJam(
      pengaturan?.jamMasukStandar || JAM_BATAS_TEPAT_WAKTU_DEFAULT,
    );
  } catch (error) {
    console.error("Gagal membaca pengaturan jam masuk standar:", error);
    return parseJam(JAM_BATAS_TEPAT_WAKTU_DEFAULT);
  }
}

function validasiLokasiAbsensi(koordinat, akurasi) {
  if (!koordinat) {
    return {
      ok: false,
      status: 400,
      pesan: "Lokasi GPS tidak valid. Silakan ambil lokasi kembali.",
    };
  }

  const akurasiMeter = Number(akurasi);
  if (
    !Number.isFinite(akurasiMeter) ||
    akurasiMeter <= 0 ||
    akurasiMeter > MAKS_AKURASI_LOKASI_METER
  ) {
    return {
      ok: false,
      status: 400,
      pesan: `Akurasi lokasi terlalu rendah (±${Number.isFinite(akurasiMeter) ? Math.round(akurasiMeter) : "-"} m). Aktifkan GPS/lokasi presisi dan ambil lokasi kembali. Maksimal akurasi yang diterima ±${MAKS_AKURASI_LOKASI_METER} m.`,
      akurasiMeter: Number.isFinite(akurasiMeter)
        ? Math.round(akurasiMeter * 10) / 10
        : null,
      batasAkurasiMeter: MAKS_AKURASI_LOKASI_METER,
    };
  }

  return {
    ok: true,
    akurasiMeter: Math.round(akurasiMeter * 10) / 10,
    batasAkurasiMeter: MAKS_AKURASI_LOKASI_METER,
  };
}

// Online: gunakan waktu server sebagai sumber kebenaran.
// Offline-sync: gunakan waktu asli ketika karyawan menekan "Kirim Absen",
// karena saat itu memang belum ada koneksi sehingga waktu server belum tersedia.
function waktuAbsensiDariRequest(req) {
  const sekarang = new Date();
  if (req.get(HEADER_OFFLINE_SYNC) !== OFFLINE_SYNC_HEADER_VALUE) return sekarang;

  const raw = String(req.body?.waktuAsli || "").trim();
  if (!raw) return sekarang;

  const kandidat = new Date(raw);
  if (Number.isNaN(kandidat.getTime())) return sekarang;

  // Tolak timestamp offline yang terlalu jauh dari waktu server. Ini menjaga
  // data tetap masuk akal tanpa menghilangkan kemampuan sinkronisasi offline.
  if (
    Math.abs(kandidat.getTime() - sekarang.getTime()) >
    MAX_OFFLINE_CLOCK_DRIFT_MS
  ) {
    return sekarang;
  }

  return kandidat;
}

function menitSekarangWIB(date = new Date()) {
  const { jam, menit } = getWIBDateParts(date);
  return jam * 60 + menit;
}

async function absenMasuk(req, res) {
  const fotoPath = req.file?.filename || null;
  let fotoTersimpanDiDatabase = false;
  let tahap = "awal";
  async function hapusFotoJikaPerlu() {
    if (!fotoPath || fotoTersimpanDiDatabase) return;
    try {
      await deleteFotoAbsensi(fotoPath);
    } catch (error) {
      console.error("Gagal membersihkan foto absen masuk:", error);
    }
  }

  try {
    tahap = "validasi-request";
    const penggunaId = req.user.id;
    const { latitude, longitude, alamat, akurasi } = req.body;
    if (!req.file) return res.status(400).json({ pesan: "Foto absen wajib diunggah." });

    tahap = "cek-izin";
    const { start, end: tanggalEnd, tanggalDate: tanggal } = getWIBTodayRange();
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

    tahap = "cek-absensi-sebelumnya";
    const sudahAbsen = await prisma.absensi.findUnique({
      where: { penggunaId_tanggal: { penggunaId, tanggal } },
    });
    if (sudahAbsen && sudahAbsen.jamMasuk) {
      await hapusFotoJikaPerlu();
      return res.status(409).json({ pesan: "Anda sudah melakukan absen masuk hari ini." });
    }

    tahap = "validasi-lokasi";
    const waktuServer = waktuAbsensiDariRequest(req);
    const menitServerWIB = menitSekarangWIB(waktuServer);
    const batasTepatWaktu = await ambilBatasTepatWaktu();
    const koordinat = koordinatDariRequest(latitude, longitude);

    if (!koordinat) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({
        pesan: "Lokasi GPS wajib tersedia sebelum absen masuk. Aktifkan lokasi HP dan izinkan lokasi untuk situs ini, lalu ambil foto lagi.",
      });
    }

    const validasiLokasi = validasiLokasiAbsensi(koordinat, akurasi);
    if (!validasiLokasi.ok) {
      await hapusFotoJikaPerlu();
      return res.status(validasiLokasi.status).json({
        pesan: validasiLokasi.pesan,
        jarakMeter: validasiLokasi.jarakMeter,
        radiusMeter: validasiLokasi.radiusMeter,
      });
    }

    if (menitServerWIB >= BATAS_ABSEN_MASUK_WIB) {
      await hapusFotoJikaPerlu();
      return res.status(409).json({
        pesan: "Waktu absen masuk sudah lewat 12:00 WIB. Absen masuk pagi tidak dapat dilakukan lagi. Silakan gunakan Absen Pulang.",
        kode: "BATAS_ABSEN_MASUK_LEWAT",
        batasAbsenMasukWIB: "12:00",
      });
    }

    // Aturan berbasis MENIT: seluruh rentang 08:10:00-08:10:59
    // masih dianggap tepat waktu. Mulai 08:11:00 baru telat.
    const statusOtomatis = menitServerWIB <= batasTepatWaktu ? "tepat_waktu" : "telat";

    const data = {
      jamMasuk: waktuServer,
      fotoMasuk: fotoPath,
      latitudeMasuk: koordinat.latitude,
      longitudeMasuk: koordinat.longitude,
      akurasiMasuk: validasiLokasi.akurasiMeter,
      alamatMasuk: alamat || null,
      statusOtomatis,
      statusFinal: statusOtomatis,
    };

    tahap = "simpan-absensi";
    let absensi;
    if (sudahAbsen) {
      const hasilUpdate = await prisma.absensi.updateMany({
        where: {
          id: sudahAbsen.id,
          jamMasuk: null,
        },
        data,
      });

      if (hasilUpdate.count !== 1) {
        await hapusFotoJikaPerlu();
        return res.status(409).json({
          pesan: "Absensi masuk sudah tercatat. Silakan periksa status hari ini.",
        });
      }

      absensi = await prisma.absensi.findUnique({
        where: { id: sudahAbsen.id },
      });
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
    console.error("Gagal memproses absen masuk:", {
      tahap,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    });
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
    const { latitude, longitude, alamat, akurasi } = req.body;
    if (!req.file) return res.status(400).json({ pesan: "Foto absen wajib diunggah." });

    const { tanggalDate: tanggal, end: tanggalEnd } = getWIBTodayRange();
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
    if (absensiHariIni?.jamPulang) {
      await hapusFotoJikaPerlu();
      return res.status(409).json({ pesan: "Anda sudah melakukan absen pulang hari ini." });
    }

    const waktuPulang = waktuAbsensiDariRequest(req);

    // Mode testing: absen pulang boleh dicatat kapan pun.
    // Bila jam masuk sudah ada, waktu pulang tetap harus >= jam masuk.
    // Bila jam masuk belum ada, record pulang tetap boleh dibuat.

    const koordinat = koordinatDariRequest(latitude, longitude);
    if (!koordinat) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({
        pesan: "Lokasi GPS wajib tersedia sebelum absen pulang. Aktifkan lokasi HP dan izinkan lokasi untuk situs ini, lalu ambil foto lagi.",
      });
    }

    const validasiLokasi = validasiLokasiAbsensi(koordinat, akurasi);
    if (!validasiLokasi.ok) {
      await hapusFotoJikaPerlu();
      return res.status(validasiLokasi.status).json({
        pesan: validasiLokasi.pesan,
        jarakMeter: validasiLokasi.jarakMeter,
        radiusMeter: validasiLokasi.radiusMeter,
      });
    }

    const waktuMasuk = absensiHariIni?.jamMasuk ? new Date(absensiHariIni.jamMasuk) : null;
    if (
      waktuMasuk &&
      (Number.isNaN(waktuMasuk.getTime()) ||
        waktuPulang.getTime() < waktuMasuk.getTime())
    ) {
      await hapusFotoJikaPerlu();
      return res.status(400).json({
        pesan: "Waktu absen pulang tidak boleh lebih awal dari waktu absen masuk.",
      });
    }

    const dataPulang = {
      jamPulang: waktuPulang,
      fotoPulang: fotoPath,
      latitudePulang: koordinat.latitude,
      longitudePulang: koordinat.longitude,
      akurasiPulang: validasiLokasi.akurasiMeter,
      alamatPulang: alamat || null,
    };

    let absensi;
    if (absensiHariIni) {
      const hasilUpdate = await prisma.absensi.updateMany({
        where: {
          id: absensiHariIni.id,
          jamPulang: null,
        },
        data: dataPulang,
      });

      if (hasilUpdate.count !== 1) {
        await hapusFotoJikaPerlu();
        return res.status(409).json({
          pesan: "Absensi pulang sudah tercatat. Silakan periksa status hari ini.",
        });
      }

      absensi = await prisma.absensi.findUnique({
        where: { id: absensiHariIni.id },
      });
    } else {
      try {
        absensi = await prisma.absensi.create({
          data: {
            penggunaId,
            tanggal,
            ...dataPulang,
          },
        });
      } catch (error) {
        if (error?.code === "P2002") {
          await hapusFotoJikaPerlu();
          return res.status(409).json({ pesan: "Absensi pulang sudah tercatat. Silakan periksa status hari ini." });
        }
        throw error;
      }
    }

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
        latitudeMasuk: true, longitudeMasuk: true, akurasiMasuk: true, alamatMasuk: true,
        latitudePulang: true, longitudePulang: true, akurasiPulang: true, alamatPulang: true,
        statusOtomatis: true, statusFinal: true, catatanAdmin: true,
      },
    });

    const dataDenganStatus = riwayat.map((item) => {
      let statusFinal = item.statusFinal || item.statusOtomatis;
      if (!statusFinal && item.jamMasuk) {
        try {
          const jamStr = new Date(item.jamMasuk).toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });
          const [h, m] = jamStr.split(":").map(Number);
          const totalMenit = (h || 0) * 60 + (m || 0);
          statusFinal = totalMenit > 490 ? "telat" : "tepat_waktu";
        } catch {
          statusFinal = "tepat_waktu";
        }
      }
      return {
        ...item,
        statusFinal: statusFinal || "tepat_waktu",
      };
    });

    return res.json({ data: dataDenganStatus });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function statusHariIni(req, res) {
  try {
    const penggunaId = req.user.id;
    const { wibDateStr, start, end, tanggalDate } = getWIBTodayRange();

    // Tiga data status tidak saling bergantung. Ambil semuanya
    // secara paralel agar load dashboard lebih cepat, sementara query manual
    // tetap aman bila tabel belum tersedia pada environment lama.
    const [absensi, pengajuanDisetujui, manualPending] = await Promise.all([
      prisma.absensi.findUnique({
        where: {
          penggunaId_tanggal: { penggunaId, tanggal: tanggalDate },
        },
        select: {
          id: true,
          tanggal: true,
          jamMasuk: true,
          jamPulang: true,
          statusOtomatis: true,
          statusFinal: true,
        },
      }),
      prisma.pengajuanIzin.findFirst({
        where: { penggunaId, tanggal: tanggalDate, status: "disetujui" },
        select: {
          id: true,
          jenis: true,
          tanggal: true,
          keterangan: true,
          status: true,
        },
      }),
      prisma.manualAbsenRequest.findFirst({
        where: {
          penggunaId,
          status: "PENDING",
          requestedAt: { gte: start, lte: end },
        },
        orderBy: { requestedAt: "desc" },
        select: { id: true, tipe: true, requestedAt: true, attemptMenit: true, keterangan: true },
      }).catch((error) => {
        // Tabel manual boleh belum tersedia pada environment lama.
        console.warn("manualAbsenRequest check failed:", error?.message || error);
        return null;
      }),
    ]);

    if (pengajuanDisetujui) {
      return res.json({
        tahap: "tidak_perlu_absen",
        data: absensi,
        pengajuanIzin: pengajuanDisetujui,
        manualPending,
      });
    }

    // Jika absensi pulang sudah ada, termasuk kasus karyawan yang datang
    // setelah batas 12:00 WIB tanpa absen masuk, hari ini dianggap selesai.
    let tahap = "belum_masuk";
    if (absensi?.jamMasuk && !absensi?.jamPulang) tahap = "sudah_masuk";
    if (absensi?.jamPulang) tahap = "selesai";

    // Setelah 12:00 WIB, jika belum ada absensi masuk maupun pulang,
    // dashboard karyawan langsung masuk mode Absen Pulang.
    if (!absensi?.jamMasuk && !absensi?.jamPulang) {
      const menitSekarang = menitSekarangWIB(new Date());
      if (menitSekarang >= BATAS_ABSEN_MASUK_WIB) {
        tahap = "langsung_pulang";
      }
    }

    // FIX: kalau belum ada absensi tapi ada manual PENDING hari ini -> anggap sudah_masuk (menunggu verifikasi)
    // biar dashboard gak balik jadi "Siap untuk absen masuk" kayak screenshot kamu
    if (!absensi && manualPending) {
      // kalau tipe masuk pending, anggap sudah_masuk
      if (manualPending.tipe === "masuk" || !manualPending.tipe) {
        tahap = "sudah_masuk";
      }
    }

    res.set("Cache-Control", "private, no-store");
    const waktuServerSekarang = new Date();
    return res.json({
      tahap,
      tanggal: wibDateStr,
      menitServerWIB: menitSekarangWIB(waktuServerSekarang),
      waktuServerEpochMs: waktuServerSekarang.getTime(),
      data: absensi,
      pengajuanIzin: null,
      manualPending,
    });
  } catch (error) {
    console.error("Gagal memuat status absensi hari ini:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server. Silakan coba lagi." });
  }
}

async function statusWajahSaya(req, res) {
  try {
    const penggunaId = req.user.id;
    const existing = await prisma.userFace.findUnique({
      where: { penggunaId },
      select: { id: true, quality: true, updatedAt: true },
    });
    return res.json({ hasFace: !!existing, data: existing || null });
  } catch (error) {
    console.error("Gagal memuat status wajah:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
}

async function updateAlamat(req, res) {
  try {
    const { id } = req.params;
    const { alamatMasuk, alamatPulang } = req.body;
    const penggunaId = req.user.id;

    const absensi = await prisma.absensi.findFirst({
      where: { id: Number(id), penggunaId },
    });
    if (!absensi) return res.status(404).json({ pesan: "Data tidak ditemukan." });

    const data = {};
    if (typeof alamatMasuk === "string" && alamatMasuk.trim()) data.alamatMasuk = alamatMasuk.trim();
    if (typeof alamatPulang === "string" && alamatPulang.trim()) data.alamatPulang = alamatPulang.trim();

    if (Object.keys(data).length === 0) return res.status(400).json({ pesan: "Tidak ada data yang diperbarui." });

    await prisma.absensi.update({ where: { id: Number(id) }, data });
    return res.json({ pesan: "Alamat berhasil diperbarui." });
  } catch (error) {
    console.error("Gagal update alamat:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
}

module.exports = { absenMasuk, absenPulang, riwayatSaya, statusHariIni, statusWajahSaya, updateAlamat };
