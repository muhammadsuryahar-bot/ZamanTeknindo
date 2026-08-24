const sharp = require("sharp");
const crypto = require("crypto");

const { uploadFotoAbsensi } = require("../utils/supabaseStorage");

const TARGET_MAKS_BYTES = 200 * 1024;
const LEBAR_MAKS_PX = 1280;

async function kompresFoto(req, res, next) {
  try {
    if (!req.file) return next();

    let kualitas = 80;

    let bufferHasil = await sharp(req.file.buffer)
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

    const namaFile =
      `${req.user.id}-` +
      `${Date.now()}-` +
      `${crypto.randomBytes(4).toString("hex")}.jpg`;

    const tanggal = new Date();

    const tahun = tanggal.getFullYear();
    const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
    const hari = String(tanggal.getDate()).padStart(2, "0");

    const filePath = `${tahun}/${bulan}/${hari}/${namaFile}`;

    console.log("FILE PATH SUPABASE:", filePath);
    console.log("FILE SIZE:", bufferHasil.length);

    const storagePath = await uploadFotoAbsensi(
      bufferHasil,
      filePath,
      "image/jpeg",
    );

    req.file.filename = storagePath;
    req.file.path = storagePath;
    req.file.size = bufferHasil.length;
    req.file.buffer = bufferHasil;
    req.file.mimetype = "image/jpeg";

    next();
  } catch (error) {
    console.error("Gagal memproses/upload foto:", error);

    return res.status(500).json({
      pesan: "Gagal memproses foto. Coba ambil ulang.",
    });
  }
}

module.exports = kompresFoto;
