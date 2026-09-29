require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const absensiRoutes = require("./routes/absensiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const izinRoutes = require("./routes/izinRoutes");
const arsipRoutes = require("./routes/arsipRoutes");
const cronRoutes = require("./routes/cronRoutes");
const pushNotificationRoutes = require("./routes/pushNotificationRoutes");
const kioskRoutes = require("./routes/kiosk");
const manualAbsenRoutes = require("./routes/manualAbsenRoutes");

const app = express();

// API bersifat dinamis dan dibaca sebagai JSON oleh frontend. Matikan ETag
// Express supaya request kondisional tidak berubah menjadi HTTP 304 tanpa body.
// Ini mencegah data dashboard/absensi/notifikasi tampak kosong karena browser
// mengirim If-None-Match dari response sebelumnya.
app.disable("etag");

// Vercel meneruskan X-Forwarded-For ke Express.
// Percayai satu hop proxy agar express-rate-limit dapat membaca IP
// dengan benar tanpa menghasilkan ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

// Endpoint API bersifat dinamis. Jangan biarkan browser mengirim
// If-None-Match/If-Modified-Since lalu menerima 304 tanpa body,
// karena frontend membaca response API sebagai JSON.
// Tanpa guard ini Rekap bisa tampak kosong walaupun database berisi data.
app.use("/api", (req, res, next) => {
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const normalisasiOrigin = (nilai) => String(nilai || "").trim().replace(/\/$/, "");
const isProduction =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
  ]
    .map(normalisasiOrigin)
    .filter(Boolean),
);

if (isProduction && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  allowedOrigins.add(
    normalisasiOrigin(
      String(process.env.VERCEL_PROJECT_PRODUCTION_URL).startsWith("http")
        ? process.env.VERCEL_PROJECT_PRODUCTION_URL
        : `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    ),
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalized = normalisasiOrigin(origin);
      if (!isProduction && /^https?:\/\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(normalized)) {
        return callback(null, true);
      }

      if (allowedOrigins.has(normalized)) {
        return callback(null, true);
      }

      return callback(new Error("Origin tidak diizinkan oleh konfigurasi CORS."));
    },
    credentials: false,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/absensi", absensiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/arsip-bulanan", arsipRoutes);
app.use("/api/izin", izinRoutes);
app.use("/api/notifikasi", pushNotificationRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/kiosk", kioskRoutes);
app.use("/api/manual-absen", manualAbsenRoutes);

app.get("/api", (req, res) => {
  res.json({ pesan: "Server Sistem Absensi berjalan dengan baik 🚀" });
});

module.exports = app;