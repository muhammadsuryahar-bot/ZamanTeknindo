const express = require("express");
const router = express.Router();

const { cekLogin, cekAdmin } = require("../middleware/authMiddleware");

const {
  daftarArsipBulanan,
  previewArsipBulanan,
  konfirmasiArsipBulanan,
  batalkanArsipBulanan,
} = require("../controllers/arsipBulananController");

router.use(cekLogin, cekAdmin);

router.get("/", daftarArsipBulanan);
router.get("/:tahun/:bulan/preview", previewArsipBulanan);
router.post("/:tahun/:bulan/konfirmasi", konfirmasiArsipBulanan);
router.post("/:tahun/:bulan/batalkan", batalkanArsipBulanan);

module.exports = router;
