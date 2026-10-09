const express = require("express");
const router = express.Router();
const { daftarAkun, login, gantiPassword, mintaResetPassword, resetPasswordDenganToken } = require("../controllers/authController");
const { batasLogin, batasDaftar, batasGantiPassword, batasLupaPassword, batasResetPasswordMandiri } = require("../middleware/rateLimiter");
const { cekLogin } = require("../middleware/authMiddleware");

router.post("/daftar", batasDaftar, daftarAkun); // POST /api/auth/daftar
router.post("/login", batasLogin, login); // POST /api/auth/login
router.post("/lupa-password", batasLupaPassword, mintaResetPassword); // POST /api/auth/lupa-password
router.post("/reset-password", batasResetPasswordMandiri, resetPasswordDenganToken); // POST /api/auth/reset-password
router.put("/ganti-password", cekLogin, batasGantiPassword, gantiPassword); // PUT /api/auth/ganti-password

module.exports = router;
