const jwt = require("jsonwebtoken");
const prisma = require("../utils/prismaClient");

// ============================================================
// CEK LOGIN
// ============================================================

async function cekLogin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      pesan: "Anda belum login. Silakan login terlebih dahulu.",
    });
  }

  const bagian = authHeader.split(" ");

  if (bagian.length !== 2 || bagian[0] !== "Bearer" || !bagian[1]) {
    return res.status(401).json({
      pesan: "Format token tidak valid. Silakan login kembali.",
    });
  }

  const token = bagian[1];

  // ==========================================================
  // 1. VERIFIKASI JWT
  // ==========================================================

  let dataToken;

  try {
    dataToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error("JWT tidak valid:", error.message);

    return res.status(401).json({
      pesan: "Sesi login tidak valid atau sudah kedaluwarsa.",
    });
  }

  // ==========================================================
  // 2. CEK USER KE DATABASE
  // ==========================================================

  let pengguna;

  try {
    pengguna = await prisma.pengguna.findUnique({
      where: {
        id: dataToken.id,
      },
      select: {
        id: true,
        nama: true,
        peran: true,
        statusAkun: true,
      },
    });
  } catch (error) {
    console.error("Gagal mengambil pengguna dari database:", error);

    // PENTING:
    // Error database bukan berarti token expired.
    // Jadi harus 500, bukan 401.
    return res.status(500).json({
      pesan: "Server gagal memeriksa sesi login. Silakan coba lagi.",
    });
  }

  // ==========================================================
  // 3. USER TIDAK DITEMUKAN
  // ==========================================================

  if (!pengguna) {
    return res.status(401).json({
      pesan: "Akun tidak ditemukan. Silakan login ulang.",
    });
  }

  // ==========================================================
  // 4. CEK STATUS AKUN
  // ==========================================================

  if (pengguna.statusAkun === "nonaktif") {
    return res.status(403).json({
      pesan: "Akun Anda telah dinonaktifkan. Hubungi Admin.",
    });
  }

  if (pengguna.statusAkun === "menunggu_konfirmasi") {
    return res.status(403).json({
      pesan: "Akun Anda masih menunggu konfirmasi Admin.",
    });
  }

  // ==========================================================
  // 5. SIMPAN USER TERKINI
  // ==========================================================

  req.user = {
    id: pengguna.id,
    nama: pengguna.nama,
    peran: pengguna.peran,
  };

  next();
}

// ============================================================
// CEK ADMIN
// ============================================================

function cekAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      pesan: "Sesi login tidak ditemukan.",
    });
  }

  if (req.user.peran !== "admin") {
    return res.status(403).json({
      pesan: "Hanya Admin yang boleh mengakses fitur ini.",
    });
  }

  next();
}

module.exports = {
  cekLogin,
  cekAdmin,
};
