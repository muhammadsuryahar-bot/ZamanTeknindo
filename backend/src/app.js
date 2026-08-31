require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const absensiRoutes = require("./routes/absensiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const izinRoutes = require("./routes/izinRoutes");
const arsipRoutes = require("./routes/arsipRoutes");
const cronRoutes = require("./routes/cronRoutes");

const app = express();

app.set("trust proxy", 1);

app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.url}`);
  next();
});

function normalisasiOrigin(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = /^https?:\/\//i.test(text)
      ? new URL(text)
      : new URL(`https://${text}`);

    return url.origin.replace(/\/$/, "");
  } catch {
    return text.replace(/\/$/, "");
  }
}

function originVercelKeHttps(value) {
  const host = String(value || "").trim();
  if (!host) return "";
  return normalisasiOrigin(host);
}

const originYangDiizinkan = new Set(
  [
    ...(process.env.FRONTEND_URL || "").split(","),
    originVercelKeHttps(process.env.VERCEL_URL),
    originVercelKeHttps(process.env.VERCEL_BRANCH_URL),
    originVercelKeHttps(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ]
    .map(normalisasiOrigin)
    .filter(Boolean),
);

const polaIpLokal =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/;
const polaNgrok = /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Request same-origin atau non-browser request tidak punya Origin.
      if (!origin) return callback(null, true);

      const originNormal = normalisasiOrigin(origin);

      if (polaIpLokal.test(origin)) return callback(null, true);
      if (polaNgrok.test(originNormal)) return callback(null, true);
      if (originYangDiizinkan.has(originNormal)) return callback(null, true);

      return callback(new Error("Domain ini tidak diizinkan mengakses API."));
    },
  }),
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/absensi", absensiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/arsip-bulanan", arsipRoutes);
app.use("/api/izin", izinRoutes);
app.use("/api/cron", cronRoutes);

app.get("/api", (req, res) => {
  res.json({ pesan: "Server Sistem Absensi berjalan dengan baik 🚀" });
});

// Jangan kirim stack trace/detail internal ke client.
app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error);

  if (res.headersSent) return next(error);

  if (error?.message === "Domain ini tidak diizinkan mengakses API.") {
    return res.status(403).json({
      pesan: "Akses dari domain ini tidak diizinkan.",
    });
  }

  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      pesan: "Ukuran foto terlalu besar. Maksimal 8MB.",
    });
  }

  if (error?.message === "File yang diunggah harus berupa gambar.") {
    return res.status(400).json({
      pesan: "File yang diunggah harus berupa gambar.",
    });
  }

  return res.status(500).json({
    pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
  });
});

module.exports = app;
