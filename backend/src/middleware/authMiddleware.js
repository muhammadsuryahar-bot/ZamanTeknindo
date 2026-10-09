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

  let dataToken;

  try {
    dataToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // Token invalid/expired adalah kegagalan autentikasi normal, bukan
    // kegagalan server. Catat sebagai warning agar monitoring tidak salah
    // menganggap percobaan token rusak sebagai error aplikasi.
    console.warn("JWT tidak valid:", error?.message || "Token invalid");

    return res.status(401).json({
      pesan: "Sesi login tidak valid atau sudah kedaluwarsa.",
      kode:
        error?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
    });
  }

  if (
    dataToken?.scope ||
    dataToken?.id === undefined ||
    dataToken?.id === null ||
    !Number.isFinite(Number(dataToken.id))
  ) {
    return res.status(401).json({
      pesan: "Token sesi tidak valid untuk endpoint ini.",
      kode: "TOKEN_SCOPE_INVALID",
    });
  }

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
        versiSesi: true,
      },
    });
  } catch (error) {
    console.error("Gagal mengambil pengguna dari database:", error);

    return res.status(500).json({
      pesan: "Server gagal memeriksa sesi login. Silakan coba lagi.",
    });
  }

  if (!pengguna) {
    return res.status(401).json({
      pesan: "Akun tidak ditemukan. Silakan login ulang.",
    });
  }

  // Password reset/ganti password/admin reset menaikkan versi sesi.
  // JWT lama (tanpa claim versiSesi) dianggap versi 0 selama masa transisi.
  const versiToken = Number.isInteger(dataToken.versiSesi) ? dataToken.versiSesi : 0;
  if (versiToken !== pengguna.versiSesi) {
    return res.status(401).json({
      pesan: "Password atau sesi akun telah diperbarui. Silakan login kembali.",
      kode: "SESSION_REVOKED",
    });
  }

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
