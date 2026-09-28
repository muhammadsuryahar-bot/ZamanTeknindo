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

// Vercel meneruskan X-Forwarded-For ke Express.
// Percayai satu hop proxy agar express-rate-limit dapat membaca IP
// dengan benar tanpa menghasilkan ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

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