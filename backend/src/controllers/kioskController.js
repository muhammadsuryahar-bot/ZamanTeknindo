const prisma = require("../utils/prismaClient");
const { buatSignedUrlFotoBatch } = require("../utils/supabaseStorage");
const FACE_THRESHOLD = 0.5;

const JAM_MASUK_MAX = process.env.JAM_MASUK_MAX || "08:10";
const JAM_PULANG_MIN = process.env.JAM_PULANG_MIN || "17:00";
const TOLERANSI_MENIT = 120; // normal 120
const TESTING_MODE = true; // true = loloskan semua jam tapi tetap hitung telat
const TESTING_LOLOSKAN_TUTUP = true; // kalau true, jam 15:10 tetap lolos tapi status = telat

function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}
function getWIBTodayRange(baseDate = new Date()) {
  const wibDateStr = baseDate.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });
  const start = new Date(`${wibDateStr}T00:00:00+07:00`);
  const end = new Date(`${wibDateStr}T23:59:59.999+07:00`);
  const tanggalOnly = new Date(`${wibDateStr}T00:00:00.000Z`);
  return { wibDateStr, start, end, tanggalOnly };
}
function getWIBNow() {
  const wibStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
  });
  return new Date(wibStr);
}
function parseJam(jamStr) {
  const [h, m] = jamStr.split(":").map(Number);
  return h * 60 + m;
}
function getWIBTimeInfo(baseDate = new Date()) {
  const wibNow = new Date(baseDate.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const jam = wibNow.getHours();
  const menit = wibNow.getMinutes();
  const totalMenit = jam * 60 + menit;
  const jamStr = `${String(jam).padStart(2, "0")}:${String(menit).padStart(2, "0")}`;
  return { wibNow, jam, menit, totalMenit, jamStr };
}

const checkKioskKey = (req, res, next) => {
  const key =
    req.headers["x-kiosk-key"] || req.body.kioskKey || req.query.kioskKey;
  if (!process.env.KIOSK_SECRET_KEY || key === process.env.KIOSK_SECRET_KEY)
    return next();
  return res.status(401).json({ message: "Kiosk key tidak valid" });
};

const verifyAdminPin = async (req, res) => {
  try {
    const { pin } = req.body;
    
    // Ambil PIN dari database
    let pengaturan = await prisma.pengaturanPotongan.findUnique({ where: { id: 1 } });
    if (!pengaturan) {
      pengaturan = await prisma.pengaturanPotongan.create({
        data: { id: 1 }
      });
    }

    const ADMIN_PIN = String(
      pengaturan.kioskPin || process.env.ADMIN_KIOSK_PIN || process.env.KIOSK_ADMIN_PIN || "246810",
    ).trim();
    const inputPin = String(pin || "").trim();

    console.log(
      `[PIN CHECK] Input: "${inputPin}" | DB/ENV: "${ADMIN_PIN}" | Match: ${inputPin === ADMIN_PIN}`,
    );

    if (!inputPin) {
      return res.status(400).json({ message: "PIN tidak boleh kosong" });
    }
    if (inputPin === ADMIN_PIN) {
      return res.json({ ok: true, message: "PIN benar" });
    }
    return res.status(401).json({
      message: `PIN admin salah. Input: ${inputPin}, Expected: ${ADMIN_PIN}`,
    });
  } catch (e) {
    console.error("verifyAdminPin error:", e);
    return res
      .status(500)
      .json({ message: "Error verifikasi PIN: " + e.message });
  }
};

const getPenggunaListKiosk = async (req, res) => {
  try {
    const users = await prisma.pengguna.findMany({
      where: { statusAkun: "aktif" },
      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
      },
    });
    const faces = await prisma.userFace.findMany({
      select: { penggunaId: true },
    });
    const faceIds = new Set(faces.map((f) => f.penggunaId));
    res.json(users.map((u) => ({ ...u, hasFace: faceIds.has(u.id) })));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getStatusKiosk = async (req, res) => {
  try {
    const penggunaId = Number(req.params.penggunaId);
    const { wibDateStr, tanggalOnly } = getWIBTodayRange();
    const { totalMenit, jamStr } = getWIBTimeInfo();
    const batasMasuk = parseJam(JAM_MASUK_MAX);
    const batasPulang = parseJam(JAM_PULANG_MIN);
    const absen = await prisma.absensi.findFirst({
      where: { penggunaId, tanggal: tanggalOnly },
      orderBy: { id: "desc" },
    });
    const jamInfo = {
      jamSekarang: jamStr,
      totalMenitSekarang: totalMenit,
      batasMasuk: JAM_MASUK_MAX,
      batasMasukMenit: batasMasuk,
      batasPulang: JAM_PULANG_MIN,
      batasPulangMenit: batasPulang,
      bolehMasuk: totalMenit <= batasMasuk + 120,
      bolehPulang: totalMenit >= batasPulang,
    };
    if (!absen)
      return res.json({
        wibDateStr,
        sudahMasuk: false,
        tipeSelanjutnya: "masuk",
        jamInfo,
      });
    if (absen.jamMasuk && !absen.jamPulang)
      return res.json({
        wibDateStr,
        sudahMasuk: true,
        tipeSelanjutnya: "pulang",
        data: absen,
        jamInfo,
      });
    if (absen.jamMasuk && absen.jamPulang)
      return res.json({
        wibDateStr,
        sudahMasuk: true,
        sudahPulang: true,
        tipeSelanjutnya: "masuk",
        data: absen,
        sudahLengkap: true,
        jamInfo,
      });
    return res.json({
      wibDateStr,
      tipeSelanjutnya: "masuk",
      data: absen,
      jamInfo,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const enrollFace = async (req, res) => {
  try {
    const targetId = Number(req.body.penggunaId || req.user?.id);
    const { descriptors, fotoSample, foto } = req.body;
    const sample = fotoSample || foto || null;
    if (!targetId || !descriptors?.length)
      return res
        .status(400)
        .json({ message: "penggunaId & descriptors wajib" });
    const data = await prisma.userFace.upsert({
      where: { penggunaId: targetId },
      update: {
        descriptors,
        ...(sample ? { fotoSample: sample } : {}),
        quality: req.user ? "WEB_USER" : "KIOSK",
      },
      create: {
        penggunaId: targetId,
        descriptors,
        fotoSample: sample,
        quality: req.user ? "WEB_USER" : "KIOSK",
      },
    });
    res.json({ message: "Wajah berhasil terdaftar di sistem", data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
};

const recognize = async (req, res) => {
  try {
    const { descriptor } = req.body;
    if (!descriptor)
      return res.status(400).json({ message: "descriptor wajib" });
    const faces = await prisma.userFace.findMany();
    let best = null;
    let bestDist = Infinity;
    for (const f of faces) {
      for (const d of f.descriptors) {
        const dist = euclidean(descriptor, d);
        if (dist < bestDist) {
          bestDist = dist;
          best = f;
        }
      }
    }
    if (best && bestDist < FACE_THRESHOLD) {
      const pengguna = await prisma.pengguna.findUnique({
        where: { id: best.penggunaId },
        select: {
          id: true,
          nama: true,
          email: true,
          jabatan: true,
          divisi: true,
          peran: true,
        },
      });
      return res.json({ matched: true, distance: bestDist, pengguna });
    } else {
      return res.json({ matched: false, distance: bestDist });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
};

const kioskAbsen = async (req, res) => {
  try {
    let { penggunaId, tipe, foto, latitude, longitude } = req.body;
    const waktuAsli = String(req.body?.waktuAsli || "").trim();
    let now = new Date();
    if (req.get("X-Zaman-Background") === "offline-sync" && waktuAsli) {
      const kandidat = new Date(waktuAsli);
      if (!Number.isNaN(kandidat.getTime()) && Math.abs(kandidat.getTime() - Date.now()) <= 24 * 60 * 60 * 1000) {
        now = kandidat;
      }
    }
    const { start, end, tanggalOnly } = getWIBTodayRange(now);
    const { totalMenit, jamStr } = getWIBTimeInfo(now);
    const batasMasuk = parseJam(JAM_MASUK_MAX);
    const batasPulang = parseJam(JAM_PULANG_MIN);
    let absen = await prisma.absensi.findFirst({
      where: {
        penggunaId: Number(penggunaId),
        tanggal: tanggalOnly,
      },
      orderBy: { id: "desc" },
    });
    if (!tipe || tipe === "auto") {
      if (!absen || !absen.jamMasuk) tipe = "masuk";
      else if (!absen.jamPulang) tipe = "pulang";
      else
        return res
          .status(400)
          .json({ message: "Sudah absen lengkap hari ini" });
    }
    if (tipe === "masuk") {
      if (absen?.jamMasuk)
        return res.status(400).json({ message: "Sudah absen masuk" });
      console.log(
        `[KIOSK TESTING TELAT] Jam sekarang: ${jamStr} (${totalMenit} menit), batas: ${JAM_MASUK_MAX} (${batasMasuk} menit), max+toleransi: ${batasMasuk + TOLERANSI_MENIT}, TESTING_MODE=${TESTING_MODE}`,
      );
      if (!TESTING_MODE && totalMenit > batasMasuk + TOLERANSI_MENIT) {
        return res.status(400).json({
          message: `Absen masuk ditutup. Maksimal jam ${JAM_MASUK_MAX} (toleransi sampai ${String(Math.floor((batasMasuk + TOLERANSI_MENIT) / 60)).padStart(2, "0")}:${String((batasMasuk + TOLERANSI_MENIT) % 60).padStart(2, "0")}). Sekarang ${jamStr} WIB`,
        });
      }
      if (TESTING_MODE && totalMenit > batasMasuk + TOLERANSI_MENIT) {
        console.log(
          `[KIOSK TESTING TELAT] Loloskan meski lewat tutup, tapi akan dihitung TELAT`,
        );
      }
      let statusOtomatis = "tepat_waktu";
      let keterangan = null;
      if (totalMenit > batasMasuk) {
        statusOtomatis = "telat";
        console.log(`[KIOSK TELAT] TELAT: ${jamStr} > ${JAM_MASUK_MAX}`);
      } else {
        console.log(
          `[KIOSK TEPAT WAKTU] TEPAT WAKTU: ${jamStr} <= ${JAM_MASUK_MAX}`,
        );
      }
      const wibDateStrForCreate = now.toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      });
      const kantorQuery = await prisma.pengguna.findUnique({
        where: { id: Number(penggunaId) },
        include: { kantor: true },
      });
      const kantor = kantorQuery?.kantor;
      
      const isGpsMissing = latitude == null || longitude == null || latitude === 0 || longitude === 0;
      const finalLatitude = isGpsMissing && kantor ? kantor.latitude : latitude;
      const finalLongitude = isGpsMissing && kantor ? kantor.longitude : longitude;
      const finalAlamat = kantor ? `Absen via Kiosk: ${kantor.namaKantor}${kantor.alamat ? ` - ${kantor.alamat}` : ''}` : null;

      const tanggalOnlyForCreate = new Date(`${wibDateStrForCreate}T00:00:00.000Z`);
      const data = absen
        ? await prisma.absensi.update({
            where: { id: absen.id },
            data: {
              jamMasuk: now,
              fotoMasuk: foto,
              latitudeMasuk: finalLatitude,
              longitudeMasuk: finalLongitude,
              alamatMasuk: finalAlamat,
              statusOtomatis,
              keterangan,
            },
          })
        : await prisma.absensi.create({
            data: {
              penggunaId: Number(penggunaId),
              tanggal: tanggalOnlyForCreate,
              jamMasuk: now,
              fotoMasuk: foto,
              latitudeMasuk: finalLatitude,
              longitudeMasuk: finalLongitude,
              alamatMasuk: finalAlamat,
              statusOtomatis,
              keterangan,
            },
          });
      const pesan =
        statusOtomatis === "telat"
          ? `Absen masuk berhasil (TERLAMBAT ${totalMenit - batasMasuk} menit)`
          : "Absen masuk berhasil";
      return res.json({
        message: pesan,
        data,
        tipe,
        statusOtomatis,
        jamMasuk: jamStr,
      });
    } else {
      if (!absen) return res.status(400).json({ message: "Belum absen masuk" });
      if (absen.jamPulang)
        return res.status(400).json({ message: "Sudah absen pulang" });
      if (totalMenit < batasPulang) {
        const sisa = batasPulang - totalMenit;
        const sisaJam = Math.floor(sisa / 60);
        const sisaMenit = sisa % 60;
        return res.status(400).json({
          message: `Belum jam pulang. Pulang mulai jam ${JAM_PULANG_MIN}. Sisa ${sisaJam > 0 ? sisaJam + " jam " : ""}${sisaMenit} menit lagi. Sekarang ${jamStr} WIB`,
        });
      }
      const kantorQuery = await prisma.pengguna.findUnique({
        where: { id: Number(penggunaId) },
        include: { kantor: true },
      });
      const kantor = kantorQuery?.kantor;

      const isGpsMissing = latitude == null || longitude == null || latitude === 0 || longitude === 0;
      const finalLatitude = isGpsMissing && kantor ? kantor.latitude : latitude;
      const finalLongitude = isGpsMissing && kantor ? kantor.longitude : longitude;
      const finalAlamat = kantor ? `Absen via Kiosk: ${kantor.namaKantor}${kantor.alamat ? ` - ${kantor.alamat}` : ''}` : null;

      const data = await prisma.absensi.update({
        where: { id: absen.id },
        data: {
          jamPulang: now,
          fotoPulang: foto,
          latitudePulang: finalLatitude,
          longitudePulang: finalLongitude,
          alamatPulang: finalAlamat,
        },
      });
      return res.json({
        message: "Absen pulang berhasil",
        data,
        tipe,
        jamPulang: jamStr,
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
};

const getAllFaces = async (req, res) => {
  try {
    const faces = await prisma.userFace.findMany();
    res.json(faces);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getFacesDetailed = async (req, res) => {
  try {
    const faces = await prisma.userFace.findMany({
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            email: true,
            jabatan: true,
            divisi: true,
            statusAkun: true,
            absensi: {
              where: { fotoMasuk: { not: null } },
              orderBy: { id: "desc" },
              take: 1,
              select: { fotoMasuk: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const fotoPaths = faces
      .map((f) => f.fotoSample || f.user?.absensi?.[0]?.fotoMasuk)
      .filter((p) => p && typeof p === "string" && !p.startsWith("data:") && !p.startsWith("http"));

    const urlMap = await buatSignedUrlFotoBatch(fotoPaths);

    const data = faces.map((f) => {
      let rawFoto = f.fotoSample || f.user?.absensi?.[0]?.fotoMasuk || null;
      let finalFotoUrl = rawFoto;
      if (rawFoto && typeof rawFoto === "string" && !rawFoto.startsWith("data:") && !rawFoto.startsWith("http")) {
        finalFotoUrl = urlMap.get(rawFoto) || rawFoto;
      }

      return {
        id: f.id,
        penggunaId: f.penggunaId,
        pengguna: f.user,
        descriptors: f.descriptors,
        fotoSample: finalFotoUrl,
        quality: f.quality,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    });
    return res.json(data);
  } catch (e) {
    console.error("getFacesDetailed error:", e);
    return res.status(500).json({ message: e.message });
  }
};

const submitManualFallback = async (req, res) => {
  try {
    let { penggunaId, foto, alasan, attemptAt, tipe } = req.body;
    penggunaId = Number(penggunaId);
    if (!penggunaId) return res.status(400).json({ message: "Pilih karyawan terlebih dahulu" });

    let attemptDate = attemptAt? new Date(attemptAt) : new Date();
    if (isNaN(attemptDate.getTime())) attemptDate = new Date();

    const wibStr = attemptDate.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const attemptStart = new Date(`${wibStr}T00:00:00+07:00`);
    const attemptEnd = new Date(`${wibStr}T23:59:59.999+07:00`);
    const tanggalOnly = new Date(`${wibStr}T00:00:00.000Z`);

    let absenHariIni = null;
    try { absenHariIni = await prisma.absensi.findFirst({ where: { penggunaId, tanggal: tanggalOnly } }); } catch {}

    // cek pending pakai snake_case
    let pending = null;
    try {
      pending = await prisma.manualAbsenRequest.findFirst({
        where: { penggunaId, requestedAt: { gte: attemptStart, lte: attemptEnd }, status: "PENDING" },
        select: { id: true, requestedAt: true, status: true }
      });
    } catch {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT id, requested_at as "requestedAt", status FROM manual_absen_request WHERE pengguna_id=$1 AND requested_at BETWEEN $2 AND $3 AND status='PENDING' LIMIT 1`,
          penggunaId, attemptStart, attemptEnd
        );
        if (rows?.[0]) pending = rows[0];
      } catch { pending = null; }
    }

    if (pending) {
      const jam = pending.requestedAt? new Date(pending.requestedAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour:"2-digit", minute:"2-digit" }) : "";
      return res.status(400).json({ message: `Pengajuan verifikasi sudah ada pada pukul ${jam} WIB.` });
    }

    let tipeFinal = tipe;
    if (!tipeFinal || tipeFinal === "auto") {
      if (!absenHariIni ||!absenHariIni.jamMasuk) tipeFinal = "masuk";
      else if (!absenHariIni.jamPulang) tipeFinal = "pulang";
      else return res.status(400).json({ message: "Presensi hari ini telah lengkap." });
    }

    const attemptWIB = new Date(attemptDate.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const attemptMenit = attemptWIB.getHours()*60 + attemptWIB.getMinutes();
    const alasanBersih = (alasan || "Deteksi wajah tidak tersedia").trim();

    // INSERT pakai snake_case, tanpa updated_at biar gak error P2022
    let data;
    try {
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO manual_absen_request (pengguna_id, tipe, foto_bukti, alasan, status, requested_at, attempt_menit, status_otomatis, created_at)
         VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, NOW())
         RETURNING id, pengguna_id as "penggunaId", tipe, status, requested_at as "requestedAt"`,
        penggunaId, tipeFinal, foto, alasanBersih, attemptDate, attemptMenit, attemptMenit > 490? "telat" : "tepat_waktu"
      );
      data = result?.[0];
    } catch (e1) {
      console.warn("Insert dengan kolom baru gagal:", e1.message);
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO manual_absen_request (pengguna_id, tipe, foto_bukti, alasan, status, requested_at, created_at)
         VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW())
         RETURNING id, pengguna_id as "penggunaId", tipe, status, requested_at as "requestedAt"`,
        penggunaId, tipeFinal, foto, alasanBersih, attemptDate
      );
      data = result?.[0];
    }

    return res.json({ message: "Pengajuan verifikasi berhasil dikirim. Menunggu persetujuan administrator.", data });
  } catch (e) {
    console.error("submitManualFallback error:", e);
    return res.status(500).json({ message: e.message || "Terjadi kesalahan sistem. Silakan coba kembali." });
  }
};

const hapusFace = async (req, res) => {
  try {
    const penggunaId = Number(req.params.penggunaId || req.params.id);
    if (!penggunaId)
      return res.status(400).json({ message: "penggunaId wajib" });
    const existing = await prisma.userFace.findUnique({
      where: { penggunaId },
    });
    if (!existing)
      return res.status(404).json({ message: "Wajah tidak ditemukan" });
    await prisma.userFace.delete({ where: { penggunaId } });
    console.log(`[KIOSK] Hapus wajah penggunaId=${penggunaId} berhasil`);
    return res.json({ message: "Wajah berhasil dihapus", penggunaId });
  } catch (e) {
    console.error("Gagal hapus wajah:", e);
    return res.status(500).json({ message: "Gagal hapus wajah: " + e.message });
  }
};

module.exports = {
  checkKioskKey,
  getAllFaces,
  getFacesDetailed,
  hapusFace,
  deleteFace: hapusFace,
  getPenggunaListKiosk,
  verifyAdminPin,
  getStatusKiosk,
  enrollFace,
  recognize,
  kioskAbsen,
  absenViaKiosk: kioskAbsen,
  submitManualFallback,
};
