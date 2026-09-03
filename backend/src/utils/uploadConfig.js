const multer = require("multer");

// Semua upload masuk ke memory terlebih dahulu. Foto absensi diproses oleh
// middleware kompresFoto, sedangkan lampiran surat izin/sakit/cuti/urgent
// boleh berupa gambar atau PDF dan diproses aman oleh middleware yang sama.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // maksimal 8MB sebelum diproses
  fileFilter: (req, file, cb) => {
    const tipe = String(file.mimetype || "").toLowerCase();

    if (tipe.startsWith("image/")) {
      cb(null, true);
      return;
    }

    // PDF hanya diizinkan untuk field lampiran pengajuan izin.
    // Dengan syarat fieldname ini, endpoint absensi tetap hanya menerima foto.
    if (tipe === "application/pdf" && file.fieldname === "fotoSurat") {
      cb(null, true);
      return;
    }

    cb(new Error("File harus berupa gambar atau PDF. PDF hanya diperbolehkan untuk lampiran surat pengajuan."));
  },
});

module.exports = upload;
