let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}
const crypto = require("crypto");
const prisma = require("../utils/prismaClient");
const {
  getWIBTodayRange,
  totalMenitWIB,
  BATAS_ABSEN_MASUK_WIB,
} = require("../utils/waktuIndonesia");

const {
  uploadFotoAbsensi,
  deleteFotoAbsensi,
} = require("../utils/supabaseStorage");

const TARGET_MAKS_BYTES = 200 * 1024;
const LEBAR_MAKS_PX = 1280;
const HEADER_OFFLINE_SYNC = "X-Zaman-Background";
const OFFLINE_SYNC_HEADER_VALUE = "offline-sync";

function menitValidasiWIB(req) {
  const offlineSync = req.get(HEADER_OFFLINE_SYNC) === OFFLINE_SYNC_HEADER_VALUE;
  if (!offlineSync) return totalMenitWIB(new Date());

  const raw = String(req.body?.waktuAsli || "").trim();
  const kandidat = new Date(raw);
  if (raw && !Number.isNaN(kandidat.getTime())) return totalMenitWIB(kandidat);

  return totalMenitWIB(new Date());
}

async function validasiSebelumUpload(req, res) {
  // Validasi dilakukan setelah Multer membaca body tetapi SEBELUM foto
  // diunggah ke Supabase. Ini mencegah tombol "Mengirim..." tertahan
  // hanya untuk akhirnya ditolak karena belum waktunya.
  const route = String(req.path || "").replace(/\/$/, "");
  if (!req.user?.id || !["/masuk", "/pulang"].includes(route)) return true;

  const penggunaId = req.user.id;
  const { tanggalDate: tanggal } = getWIBTodayRange();
  const menitValidasi = menitValidasiWIB(req);

  try {
    const [pengajuanDisetujui, absensi] = await Promise.all([
      prisma.pengajuanIzin.findFirst({
        where: { penggunaId, tanggal, status: "disetujui" },
        select: { id: true, jenis: true },
      }),
      prisma.absensi.findUnique({
        where: { penggunaId_tanggal: { penggunaId, tanggal } },
        select: { id: true, jamMasuk: true, jamPulang: true },
      }),
    ]);

    if (pengajuanDisetujui) {
      res.status(400).json({
        pesan: "Absensi tidak diperlukan. Pengajuan " + pengajuanDisetujui.jenis + " kamu untuk hari ini sudah disetujui Admin.",
        jenisPengajuan: pengajuanDisetujui.jenis,
      });
      return false;
    }

    if (route === "/masuk") {
      if (menitValidasi >= BATAS_ABSEN_MASUK_WIB) {
        res.status(409).json({
          pesan: "Waktu absen masuk sudah lewat 12:00 WIB. Absen masuk pagi tidak dapat dilakukan lagi. Silakan gunakan Absen Pulang.",
          kode: "BATAS_ABSEN_MASUK_LEWAT",
          batasAbsenMasukWIB: "12:00",
        });
        return false;
      }

      if (absensi?.jamMasuk) {
        res.status(409).json({
          pesan: "Anda sudah melakukan absen masuk hari ini.",
        });
        return false;
      }

      req.absensiPreflight = { penggunaId, tanggal, absensi, route };
      return true;
    }

    if (absensi?.jamPulang) {
      res.status(409).json({
        pesan: "Anda sudah melakukan absen pulang hari ini.",
      });
      return false;
    }

    if (!absensi?.jamMasuk && menitValidasi < BATAS_ABSEN_MASUK_WIB) {
      res.status(400).json({
        pesan: "Anda belum melakukan absen masuk hari ini. Absen pulang tanpa absen masuk hanya tersedia mulai 12:00 WIB.",
        kode: "BELUM_ABSEN_MASUK",
        batasAbsenPulangTanpaMasukWIB: "12:00",
      });
      return false;
    }

    req.absensiPreflight = { penggunaId, tanggal, absensi, route };
    return true;
  } catch (error) {
    console.error("Preflight absensi gagal:", error);
    res.status(503).json({
      pesan: "Server belum dapat memeriksa status absensi. Silakan coba lagi.",
      kode: "STATUS_ABSENSI_TIDAK_TERSEDIA",
    });
    return false;
  }
}

function buatPathStorage(penggunaId, ekstensi = "jpg") {
  const sekarang = new Date();
  const tahun = sekarang.getUTCFullYear();
  const bulan = String(sekarang.getUTCMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getUTCDate()).padStart(2, "0");
  const namaFile = `${penggunaId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ekstensi}`;
  return `${tahun}/${bulan}/${hari}/${namaFile}`;
}

async function kompresFoto(req, res, next) {
  try {
    if (!req.file) return next();

    const bolehUpload = await validasiSebelumUpload(req, res);
    if (!bolehUpload) return;

    // Lampiran surat boleh PDF. PDF tidak boleh dilewatkan ke Sharp karena
    // Sharp hanya dipakai untuk gambar. Upload PDF langsung ke Storage.
    if (req.file.mimetype === "application/pdf" && req.file.fieldname === "fotoSurat") {
      const filePath = buatPathStorage(req.user.id, "pdf");
      const storagePath = await uploadFotoAbsensi(
        req.file.buffer,
        filePath,
        "application/pdf",
      );

      req.file.filename = storagePath;
      req.file.path = storagePath;
      req.file.size = req.file.buffer.length;

      res.once("finish", () => {
        if (res.statusCode >= 400 && storagePath) {
          deleteFotoAbsensi(storagePath).catch((error) => {
            console.error(
              "Gagal membersihkan lampiran setelah request gagal:",
              error,
            );
          });
        }
      });

      return next();
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        pesan: "Lampiran harus berupa gambar atau PDF.",
      });
    }

    let bufferHasil = req.file.buffer;

    // Gunakan sharp hanya jika tersedia (tidak tersedia di Vercel serverless)
    // Frontend sudah mengkompresi foto sebelum upload, jadi aman tanpa sharp.
    if (sharp) {
      let kualitas = 80;

      bufferHasil = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: LEBAR_MAKS_PX,
          withoutEnlargement: true,
        })
        .jpeg({ quality: kualitas })
        .toBuffer();

      while (bufferHasil.length > TARGET_MAKS_BYTES && kualitas > 30) {
        kualitas -= 10;

        bufferHasil = await sharp(req.file.buffer)
          .rotate()
          .resize({
            width: LEBAR_MAKS_PX,
            withoutEnlargement: true,
          })
          .jpeg({ quality: kualitas })
          .toBuffer();
      }
    } else {
      console.log("[kompresFoto] sharp tidak tersedia, upload buffer asli (frontend sudah kompresi)");
    }

    const mimeAsli = String(req.file.mimetype || "").toLowerCase();
    let storageMimeType = mimeAsli;
    let ekstensi = mimeAsli.split("/")[1] || "jpg";

    if (sharp) {
      // Sharp selalu menghasilkan JPEG di atas. Samakan ekstensi dan
      // Content-Type agar browser/storage tidak menerima metadata yang salah.
      storageMimeType = "image/jpeg";
      ekstensi = "jpg";
    } else {
      const ekstensiAman = new Set([
        "jpeg",
        "jpg",
        "png",
        "webp",
        "gif",
        "bmp",
        "tiff",
      ]);
      if (!ekstensiAman.has(ekstensi)) ekstensi = "jpg";
    }

    const filePath = buatPathStorage(req.user.id, ekstensi);

    console.log("FILE PATH SUPABASE:", filePath);
    console.log("FILE SIZE:", bufferHasil.length);

    const storagePath = await uploadFotoAbsensi(
      bufferHasil,
      filePath,
      storageMimeType,
    );

    req.file.filename = storagePath;
    req.file.path = storagePath;
    req.file.size = bufferHasil.length;
    req.file.buffer = bufferHasil;

    // Foto sudah masuk Storage sebelum controller berjalan. Jika request
    // akhirnya gagal, bersihkan file agar tidak menjadi orphan file.
    res.once("finish", () => {
      if (res.statusCode >= 400 && storagePath) {
        deleteFotoAbsensi(storagePath).catch((error) => {
          console.error(
            "Gagal membersihkan foto setelah request gagal:",
            error,
          );
        });
      }
    });

    next();
  } catch (error) {
    console.error("Gagal memproses/upload foto:", error);

    return res.status(500).json({
      pesan: "Gagal memproses file. Coba pilih file lain lalu ulangi.",
    });
  }
}

module.exports = kompresFoto;
