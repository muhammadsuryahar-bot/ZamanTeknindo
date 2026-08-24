const express = require("express");
const router = express.Router();
const { cekLogin } = require("../middleware/authMiddleware");
const upload = require("../utils/uploadConfig");
const kompresFoto = require("../middleware/kompresFoto");
const {
  absenMasuk,
  absenPulang,
  riwayatSaya,
  statusHariIni,
} = require("../controllers/absensiController");

// Semua rute di bawah ini wajib login dulu
router.use(cekLogin);

router.post("/masuk", upload.single("foto"), kompresFoto, absenMasuk); // POST /api/absensi/masuk
router.post("/pulang", upload.single("foto"), kompresFoto, absenPulang); // POST /api/absensi/pulang
router.get("/riwayat-saya", riwayatSaya); // GET /api/absensi/riwayat-saya
router.get("/status-hari-ini", statusHariIni); // GET /api/absensi/status-hari-ini

module.exports = router;