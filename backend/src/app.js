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

// Daftar alamat frontend yang boleh mengakses API.
// Untuk production, isi FRONTEND_URL dengan domain resmi, misalnya:
// https://zaman-teknindo.vercel.app
// Untuk beberapa domain, pisahkan dengan koma.
const originYangDiizinkan = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const polaIpLokal = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/;
const polaNgrok = /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Request server-to-server / same-origin tanpa header Origin.
      if (!origin) return callback(null, true);

      // Development lokal.
      if (polaIpLokal.test(origin)) return callback(null, true);

      // Development/testing melalui ngrok.
      if (polaNgrok.test(origin)) return callback(null, true);

      // Production / domain yang memang kita daftarkan.
      if (originYangDiizinkan.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Domain ini tidak diizinkan mengakses API."));
    },
  }),
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
