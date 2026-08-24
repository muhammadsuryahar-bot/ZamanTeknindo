const multer = require("multer");

// Foto ditampung dulu di memori (bukan langsung ditulis ke disk),
// supaya bisa dikompres dulu oleh middleware "kompresFoto" sebelum
// benar-benar disimpan. Lihat src/middleware/kompresFoto.js.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // maksimal 8MB sebelum dikompres
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("File yang diunggah harus berupa gambar."));
    }
  },
});

module.exports = upload;
