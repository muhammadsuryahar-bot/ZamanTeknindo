const express = require("express");
const router = express.Router();

const { jalankanCleanupAbsensi } = require("../controllers/arsipBulananController");

function cekCronSecret(req, res, next) {
  const secret = String(process.env.CRON_SECRET || "").trim();

  if (!secret) {
    console.error("CRON_SECRET belum dikonfigurasi.");
    return res.status(500).json({
      pesan: "CRON_SECRET belum dikonfigurasi pada server.",
    });
  }

  const authorization = String(req.headers.authorization || "").trim();
  const expected = `Bearer ${secret}`;

  if (authorization !== expected) {
    return res.status(401).json({
      pesan: "Unauthorized.",
    });
  }

  next();
}

router.get("/cleanup-absensi", cekCronSecret, jalankanCleanupAbsensi);

module.exports = router;
