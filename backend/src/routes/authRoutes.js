const express = require("express");
const router = express.Router();
const { daftarAkun, login, gantiPassword } = require("../controllers/authController");
const { batasLogin, batasDaftar, batasGantiPassword } = require("../middleware/rateLimiter");
const { cekLogin } = require("../middleware/authMiddleware");

router.post("/daftar", batasDaftar, daftarAkun); // POST /api/auth/daftar
router.post("/login", batasLogin, login); // POST /api/auth/login
router.put("/ganti-password", cekLogin, batasGantiPassword, gantiPassword); // PUT /api/auth/ganti-password

module.exports = router;
