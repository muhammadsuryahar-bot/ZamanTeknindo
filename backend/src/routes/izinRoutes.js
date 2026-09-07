const express = require("express");
const router = express.Router();
const upload = require("../utils/uploadConfig");
const kompresFoto = require("../middleware/kompresFoto");
const { cekLogin, cekAdmin } = require("../middleware/authMiddleware");
const {
  ajukanIzinFixed,
  riwayatIzinSaya,
  daftarSemuaIzin,
  setujuiIzinFixed,
  tolakIzinFixed,
} = require("../controllers/izinFixedController");

// ------------------------------------------------------------
// KARYAWAN — cukup login, gak perlu admin
// ------------------------------------------------------------
router.post("/ajukan", cekLogin, upload.single("fotoSurat"), kompresFoto, ajukanIzinFixed);
router.get("/riwayat-saya", cekLogin, riwayatIzinSaya);

// ------------------------------------------------------------
// ADMIN — wajib login DAN berperan admin
// ------------------------------------------------------------
router.get("/semua", cekLogin, cekAdmin, daftarSemuaIzin);
router.put("/:id/setujui", cekLogin, cekAdmin, setujuiIzinFixed);
router.put("/:id/tolak", cekLogin, cekAdmin, tolakIzinFixed);

module.exports = router;
