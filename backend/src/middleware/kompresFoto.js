const sharp = require("sharp");
const crypto = require("crypto");

const {
  uploadFotoAbsensi,
  deleteFotoAbsensi,
} = require("../utils/supabaseStorage");

const TARGET_MAKS_BYTES = 200 * 1024;
const LEBAR_MAKS_PX = 1280;

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

    const filePath = buatPathStorage(req.user.id, "jpg");

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
