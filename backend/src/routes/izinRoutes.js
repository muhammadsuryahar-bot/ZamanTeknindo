const express = require("express");
const router = express.Router();
const upload = require("../utils/uploadConfig");
const kompresFoto = require("../middleware/kompresFoto");
const { cekLogin, cekAdmin } = require("../middleware/authMiddleware");
const {
  ajukanIzin,
  riwayatIzinSaya,
  daftarSemuaIzin,
  setujuiIzin,
  tolakIzin,
} = require("../controllers/izinController");

// ------------------------------------------------------------
// KARYAWAN — cukup login, gak perlu admin
// ------------------------------------------------------------
router.post("/ajukan", cekLogin, upload.single("fotoSurat"), kompresFoto, ajukanIzin); // POST /api/izin/ajukan
router.get("/riwayat-saya", cekLogin, riwayatIzinSaya); // GET /api/izin/riwayat-saya

// ------------------------------------------------------------
// ADMIN — wajib login DAN berperan admin
// ------------------------------------------------------------
router.get("/semua", cekLogin, cekAdmin, daftarSemuaIzin); // GET /api/izin/semua?status=menunggu
router.put("/:id/setujui", cekLogin, cekAdmin, setujuiIzin); // PUT /api/izin/1/setujui
router.put("/:id/tolak", cekLogin, cekAdmin, tolakIzin); // PUT /api/izin/1/tolak

module.exports = router;
