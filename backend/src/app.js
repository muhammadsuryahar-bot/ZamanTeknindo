require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const absensiRoutes = require("./routes/absensiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const izinRoutes = require("./routes/izinRoutes");

const app = express();

app.set("trust proxy", 1);

app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.url}`);
  next();
});

// Daftar alamat frontend yang boleh akses API ini.
// Saat digabung 1 domain di Vercel, request frontend->backend jadi
// same-origin (relatif ke "/api"), jadi CORS di bawah ini praktis
// hanya relevan untuk development lokal / akses dari luar domain.
const originYangDiizinkan = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const polaIpLokal = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/;
const polaNgrok = /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/;
const polaVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (polaIpLokal.test(origin)) return callback(null, true);
      if (polaNgrok.test(origin)) return callback(null, true);
      if (polaVercelPreview.test(origin)) return callback(null, true);
      if (originYangDiizinkan.includes(origin)) return callback(null, true);
      return callback(new Error("Domain ini tidak diizinkan mengakses API."));
    },
  })
);
app.use(express.json());

// Rute-rute utama
app.use("/api/auth", authRoutes);
app.use("/api/absensi", absensiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/izin", izinRoutes);

// Rute cek server hidup
app.get("/api", (req, res) => {
  res.json({ pesan: "Server Sistem Absensi berjalan dengan baik 🚀" });
});

module.exports = app;
